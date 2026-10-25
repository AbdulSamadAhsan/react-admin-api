const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Order } = require('../models/OrderModel');
const emails = require('../services/orderStatusEmail');
const { changeStatus } = require('../services/orderStatusService');
afterEach(() => mock.restoreAll());
test('completion settles only unpaid COD inside the status transaction', async () => {
  const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
  mock.method(mongoose, 'startSession', async () => session);
  let current, sent;
  mock.method(Order, 'findOneAndUpdate', (filter, update, options) => {
    assert.equal(options.session, session);
    if (update.$set.paymentStatus) {
      assert.equal(current.paymentMethod, 'cash_on_delivery');
      assert.equal(current.paymentStatus, 'unpaid');
      current = { ...current, paymentStatus: 'paid' };
    } else {
      assert.deepEqual(update.$set, { status: 'delivered' });
      current = { ...current, status: 'delivered' };
    }
    return { lean: async () => current };
  });
  mock.method(emails, 'enqueue', async order => { sent = order; return null; });
  for (const paymentMethod of ['cash_on_delivery', 'stripe']) {
    for (const paymentStatus of ['unpaid', 'failed', 'refunded', 'paid']) {
      current = { _id: 'order', status: 'shipped', paymentMethod, paymentStatus };
      const result = await changeStatus('order', 'completed');
      assert.equal(result.status, 'delivered');
      assert.equal(result.paymentStatus, paymentMethod === 'cash_on_delivery' && paymentStatus === 'unpaid' ? 'paid' : paymentStatus);
      assert.equal(sent, result);
    }
  }
});
test('retry of a completed COD order repairs payment without another status email', async () => {
  const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
  mock.method(mongoose, 'startSession', async () => session);
  const old = { _id: 'order', status: 'completed', paymentMethod: 'cash_on_delivery', paymentStatus: 'unpaid' };
  mock.method(Order, 'findOneAndUpdate', (filter, update) => ({ lean: async () => update.$set.paymentStatus ? { ...old, paymentStatus: 'paid' } : null }));
  mock.method(Order, 'findById', () => ({ session() { return this; }, lean: async () => old }));
  const email = mock.method(emails, 'enqueue', async () => { throw new Error('duplicate email'); });
  assert.equal((await changeStatus('order', 'completed')).paymentStatus, 'paid');
  assert.equal(email.mock.callCount(), 0);
});
