// Contract tests isolate access control; auth.test.js checks the real guards.
const authPath = require.resolve('../middlewares/auth');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authenticate: (req, res, next) => next(), authorize: () => (req, res, next) => next() } };
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { Order } = require('../models/OrderModel');
const { StoreSettings } = require('../models/StoreSettingsModel');
const mongoose = require('mongoose');
const statusEmails = require('../services/orderStatusEmail');

test('dashboard contracts constrain order writes', async t => {
    const app = express();
    app.use(express.json());
    app.use('/api/orders', require('../routes/OrderRoute'));
    app.use('/api/customers', require('../routes/CustomerRoute'));
    app.use('/api/settings', require('../routes/SettingsRoute'));
    const id = '507f1f77bcf86cd799439011';
    const order = { _id: id, orderNumber: 'ORD-1047', customer: { name: 'Buyer', email: 'buyer@example.com' }, items: [{ name: 'Bag', quantity: 2, price: 89 }], total: 178, currency: 'USD', status: 'processing', createdAt: new Date('2026-10-14') };
    const originals = { find: Order.find, count: Order.countDocuments, update: Order.findOneAndUpdate, byId: Order.findById, settingsFind: StoreSettings.findOne, settingsUpdate: StoreSettings.findOneAndUpdate };
    let latestUpdate;
    const previousStart = mongoose.startSession, previousEnqueue = statusEmails.enqueue;
    mongoose.startSession = async () => ({ async withTransaction(callback) { await callback(); }, async endSession() {} });
    statusEmails.enqueue = async () => null;
    Order.find = () => ({ sort() { return this; }, skip() { return this; }, limit() { this.paginated = true; return this; }, lean: async function () { return this.paginated ? [order] : [order, { ...order, status: 'cancelled', createdAt: new Date('2026-09-01') }]; } });
    Order.countDocuments = async () => 1;
    Order.findById = () => ({ session() { return this; }, lean: async () => order });
    Order.findOneAndUpdate = (received, update, options) => ({ lean: async () => {
        assert.deepEqual(received, { _id: id, status: { $nin: ['delivered', 'completed', 'cancelled', update.$set.status] } });
        assert.equal(options.runValidators, true);
        if (['delivered', 'completed', 'cancelled'].includes(order.status)) return null;
        latestUpdate = update;
        if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(update.$set.status)) throw Object.assign(new Error(), { name: 'ValidationError' });
        return { ...order, ...update.$set };
    } });
    let storedSettings;
    StoreSettings.findOne = async () => storedSettings;
    StoreSettings.findOneAndUpdate = async (filter, update, options) => { assert.equal(options.upsert, true); storedSettings = update.$set; return storedSettings; };
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (route, data) => fetch(base + route, data ? { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {});
    try {
        await t.test('lists paginated orders and item snapshots', async () => {
            const response = await request('/api/orders?limit=100');
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.orders[0].items[0].quantity, 2);
            assert.equal(body.pagination.total, 1);
            assert.equal((await request('/api/orders?limit=101')).status, 400);
            assert.equal((await request('/api/orders?page=0')).status, 400);
            assert.equal((await request(`/api/orders/${id}`)).status, 200);
            assert.equal((await request('/api/orders/invalid')).status, 400);
        });
        await t.test('updates status only and rejects other fields and invalid statuses', async () => {
            const response = await request(`/api/orders/${id}`, { status: 'shipped' });
            assert.equal(response.status, 200);
            const saved = (await response.json()).order;
            assert.equal(saved.status, 'shipped');
            assert.equal(saved.total, 178);
            assert.deepEqual(latestUpdate, { $set: { status: 'shipped' } });
            for (const data of [{ total: 1 }, { status: 'pending', customer: {} }, { trackingNumber: 'track' }, {}, { status: 'unknown' }]) assert.equal((await request(`/api/orders/${id}`, data)).status, 400);
        });
        await t.test('cancelled orders cannot be reopened', async () => {
            for (const terminal of ['delivered', 'completed', 'cancelled']) {
            order.status = terminal;
            try {
                const response = await request(`/api/orders/${id}`, { status: 'processing' });
                assert.equal(response.status, 409);
                assert.equal(order.status, terminal);
            } finally { order.status = 'processing'; }
            }
        });
        await t.test('groups customers by email and excludes cancelled spending', async () => {
            const response = await request('/api/customers');
            assert.equal(response.status, 200);
            const [customer] = (await response.json()).customers;
            assert.equal(customer.orders, 2);
            assert.deepEqual(customer.totalsByCurrency, { USD: 178 });
            assert.equal(customer.memberSince, '2026-09-01T00:00:00.000Z');
        });
        await t.test('loads defaults and persists validated settings', async () => {
            assert.equal((await (await request('/api/settings')).json()).settings.storeName, 'Studio Store');
            assert.equal((await request('/api/settings', { storeName: ' Saved store ', contactEmail: 'owner@example.com', currency: 'USD' })).status, 200);
            assert.equal((await (await request('/api/settings')).json()).settings.storeName, 'Saved store');
            const converted = await request('/api/settings', { storeName: 'Saved store', contactEmail: 'owner@example.com', currency: 'PKR', exchangeRate: 280 });
            assert.equal(converted.status, 200);
            assert.equal((await converted.json()).settings.exchangeRate, 280);
            assert.equal((await (await request('/api/settings')).json()).settings.currency, 'PKR');
            for (const patch of [{ exchangeRate: 0 }, { exchangeRate: -2 }, { exchangeRate: '280' }, { exchangeRate: 1000001 }, { currency: 'FAKE', exchangeRate: 1 }, { currency: 'USD', exchangeRate: 2 }]) {
                assert.equal((await request('/api/settings', { storeName: 'Saved store', contactEmail: 'owner@example.com', currency: 'PKR', exchangeRate: 280, ...patch })).status, 400);
            }
            for (const data of [{}, { storeName: ' ', contactEmail: 'invalid', currency: 'USD' }, { storeName: 'Store', contactEmail: 'valid@example.com', currency: 'EUR' }]) assert.equal((await request('/api/settings', data)).status, 400);
        });
    } finally {
        mongoose.startSession = previousStart; statusEmails.enqueue = previousEnqueue;
        Object.assign(Order, { find: originals.find, countDocuments: originals.count, findOneAndUpdate: originals.update, findById: originals.byId });
        Object.assign(StoreSettings, { findOne: originals.settingsFind, findOneAndUpdate: originals.settingsUpdate });
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});
