const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.ADMIN_REGISTRATION_KEY = crypto.randomBytes(48).toString('hex');
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: async () => {} };
const { Admin } = require('../models/AdminModel');
const { AuthAttempt } = require('../models/AuthAttemptModel');
const { Product } = require('../models/ProductModel');
const service = require('../services/AdminService');
const app = require('../server');

test('admin authentication and protected dashboard routes', async t => {
    const accounts = new Map();
    const attempts = new Map();
    const id = '507f1f77bcf86cd799439011';
    let token;
    let productCalls = 0;
    let forcedDbFailure = false;
    const password = 'A long unique passphrase 123!';
    Admin.create = async data => {
        if (accounts.has(data.email)) throw Object.assign(new Error('duplicate'), { code: 11000 });
        const admin = { _id: id, ...data };
        accounts.set(data.email, admin);
        return admin;
    };
    Admin.findOne = ({ email }) => ({ select: async () => accounts.get(email) });
    Admin.findById = value => ({ select: async () => {
        if (forcedDbFailure) throw new Error('DB offline');
        return [...accounts.values()].find(account => account._id === value);
    } });
    AuthAttempt.findOneAndUpdate = async ({ _id }) => {
        const count = (attempts.get(_id) || 0) + 1;
        attempts.set(_id, count);
        return { count };
    };
    Product.find = async () => { productCalls++; return []; };
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (route, method = 'GET', data, headers = {}) => {
        const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: data ? JSON.stringify(data) : undefined });
        return { status: response.status, body: await response.json(), headers: response.headers };
    };
    const registration = { name: 'Admin', email: 'ADMIN@example.com', password, role: 'viewer', active: false };
    try {
        await t.test('dashboard and account routes require authentication', async () => {
            for (const method of ['GET', 'POST', 'PUT', 'DELETE']) assert.equal((await request('/api/coupons' + (['PUT', 'DELETE'].includes(method) ? '/aaaaaaaaaaaaaaaaaaaaaaaa' : ''), method)).status, 401);
            assert.equal((await request('/api/products/aaaaaaaaaaaaaaaaaaaaaaaa/reviews')).status, 401);
            for (const resource of ['products', 'orders', 'customers', 'settings']) assert.equal((await request('/api/' + resource)).status, 401);
            assert.equal(productCalls, 0);
            assert.equal((await request('/api/admin/me')).status, 401);
        });
        await t.test('registration requires setup key and valid password', async () => {
            assert.equal((await request('/api/admin/register', 'POST', registration)).status, 403);
            assert.equal((await request('/api/admin/register', 'POST', registration, { 'x-admin-registration-key': 'wrong' })).status, 403);
            assert.equal(accounts.size, 0);
            const headers = { 'x-admin-registration-key': process.env.ADMIN_REGISTRATION_KEY };
            for (const invalidPassword of ['short', 'é'.repeat(40)]) {
                assert.equal((await request('/api/admin/register', 'POST', { ...registration, password: invalidPassword }, headers)).status, 400);
            }
        });
        await t.test('registration hashes password and ignores caller roles', async () => {
            const response = await request('/api/admin/register', 'POST', registration, { 'x-admin-registration-key': process.env.ADMIN_REGISTRATION_KEY });
            assert.equal(response.status, 201);
            const account = accounts.get('admin@example.com');
            assert.notEqual(account.password, password);
            assert.ok(await bcrypt.compare(password, account.password));
            assert.equal(account.role, 'admin');
            assert.equal(account.active, true);
            assert.equal(response.body.admin.password, undefined);
            assert.equal(response.headers.get('cache-control'), 'no-store');
            token = response.body.token;
            const claims = service.verifyToken(token);
            assert.equal(claims.sub, id);
            assert.equal(claims.exp - claims.iat, 3600);
        });
        await t.test('duplicate normalized email is rejected', async () => {
            assert.equal((await request('/api/admin/register', 'POST', registration, { 'x-admin-registration-key': process.env.ADMIN_REGISTRATION_KEY })).status, 409);
        });
        await t.test('login rejects invalid credentials and returns token for valid credentials', async () => {
            const wrong = await request('/api/admin/login', 'POST', { email: registration.email, password: 'wrong password' });
            const absent = await request('/api/admin/login', 'POST', { email: 'absent@example.com', password });
            assert.equal(wrong.status, 401);
            assert.deepEqual(wrong.body, absent.body);
            const response = await request('/api/admin/login', 'POST', { email: registration.email, password });
            assert.equal(response.status, 200);
            assert.equal(response.body.admin.password, undefined);
            token = response.body.token;
        });
        await t.test('valid admin can list products and inspect account', async () => {
            const headers = { Authorization: `Bearer ${token}` };
            assert.equal((await request('/api/products', 'GET', undefined, headers)).status, 200);
            assert.equal(productCalls, 1);
            const me = await request('/api/admin/me', 'GET', undefined, headers);
            assert.equal(me.status, 200);
            assert.equal(me.body.admin.email, 'admin@example.com');
            assert.equal(me.body.admin.password, undefined);
        });
        await t.test('expired, forged, wrong audience and wrong algorithm tokens are rejected', async () => {
            const options = { subject: id, issuer: 'react-admin-api', audience: 'react-admin', expiresIn: '1h' };
            const badTokens = [
                `${token}tampered`,
                jwt.sign({}, process.env.JWT_SECRET, { ...options, expiresIn: -1 }),
                jwt.sign({}, process.env.JWT_SECRET, { ...options, audience: 'another-app' }),
                jwt.sign({}, process.env.JWT_SECRET, { ...options, algorithm: 'HS384' })
            ];
            for (const badToken of badTokens) assert.equal((await request('/api/admin/me', 'GET', undefined, { Authorization: `Bearer ${badToken}` })).status, 401);
        });
        await t.test('current account role and status override previously issued token', async () => {
            const account = accounts.get('admin@example.com');
            account.role = 'viewer';
            assert.equal((await request('/api/admin/me', 'GET', undefined, { Authorization: `Bearer ${token}` })).status, 403);
            account.role = 'admin'; account.active = false;
            assert.equal((await request('/api/admin/me', 'GET', undefined, { Authorization: `Bearer ${token}` })).status, 401);
            account.active = true;
            accounts.delete(account.email);
            assert.equal((await request('/api/admin/me', 'GET', undefined, { Authorization: `Bearer ${token}` })).status, 401);
            accounts.set(account.email, account);
        });
        await t.test('database failure and missing signing secret fail closed', async () => {
            forcedDbFailure = true;
            assert.equal((await request('/api/admin/me', 'GET', undefined, { Authorization: `Bearer ${token}` })).status, 503);
            forcedDbFailure = false;
            const secret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;
            assert.equal((await request('/api/admin/me', 'GET', undefined, { Authorization: `Bearer ${token}` })).status, 503);
            process.env.JWT_SECRET = secret;
        });
        await t.test('login attempts are limited across requests', async () => {
            // Drive the real limit service with the mocked persistent counter.
            const email = 'limited@example.com';
            for (let i = 0; i < 10; i++) assert.ok(await service.consumeAttempt('login', email, 10));
            const response = await request('/api/admin/login', 'POST', { email, password });
            assert.equal(response.status, 429);
            assert.equal(response.headers.get('retry-after'), '900');
        });
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});
