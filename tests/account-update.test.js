const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: async () => {} };
const { Admin } = require('../models/AdminModel');
const { AuthAttempt } = require('../models/AuthAttemptModel');
const service = require('../services/AdminService');
const app = require('../server');

test('admin can change own credentials with current password and revoke old sessions', async t => {
  const originalPassword = 'Original test passphrase 123';
  let account = { _id: '507f1f77bcf86cd799439011', name: 'Admin', email: 'old@example.com', password: await bcrypt.hash(originalPassword, 12), role: 'admin', active: true, sessionVersion: 0 };
  Admin.findById = () => ({ select: async () => ({ ...account }) });
  Admin.findOne = ({ email }) => ({ select: async () => email === account.email ? { ...account } : null });
  AuthAttempt.findOneAndUpdate = async () => ({ count: 1 });
  Admin.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter._id, account._id);
    assert.equal(filter.password, account.password);
    if (update.$set.email === 'taken@example.com') throw Object.assign(new Error(), { code: 11000 });
    account = { ...account, ...update.$set, sessionVersion: account.sessionVersion + 1 };
    return account;
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let token = service.issueToken(account);
  const update = data => fetch(base + '/api/admin/me', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  try {
    assert.equal((await fetch(base + '/api/admin/me', { method: 'PATCH' })).status, 401);
    await t.test('wrong password, invalid fields and duplicate email preserve account', async () => {
      const before = { ...account };
      assert.equal((await update({ email: 'new@example.com', currentPassword: 'wrong' })).status, 403);
      for (const data of [{ email: 'invalid', currentPassword: originalPassword }, { newPassword: 'short', currentPassword: originalPassword }, { email: 'new@example.com', currentPassword: originalPassword, role: 'viewer' }]) assert.equal((await update(data)).status, 400);
      assert.equal((await update({ email: 'taken@example.com', currentPassword: originalPassword })).status, 409);
      assert.deepEqual(account, before);
    });
    await t.test('email-only update preserves hash, normalizes email and revokes previous token', async () => {
      const hash = account.password;
      const response = await update({ email: ' NEW@EXAMPLE.COM ', currentPassword: originalPassword });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.admin.email, 'new@example.com');
      assert.equal(body.admin.password, undefined);
      assert.equal(body.admin.sessionVersion, undefined);
      assert.equal(account.password, hash);
      assert.equal((await fetch(base + '/api/admin/me', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
    });
    await t.test('password-only update hashes password, revokes tokens, and supports new login', async () => {
      token = service.issueToken(account);
      const nextPassword = 'A different test passphrase 456';
      assert.equal((await update({ currentPassword: originalPassword, newPassword: originalPassword })).status, 400);
      assert.equal((await update({ currentPassword: originalPassword, newPassword: nextPassword })).status, 200);
      assert.notEqual(account.password, nextPassword);
      assert.ok(await bcrypt.compare(nextPassword, account.password));
      assert.equal(account.email, 'new@example.com');
      assert.equal((await fetch(base + '/api/admin/me', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
      for (const [password, status] of [[originalPassword, 401], [nextPassword, 200]]) {
        const response = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password }) });
        assert.equal(response.status, status);
      }
    });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
