const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Order } = require('../models/OrderModel');
const emails = require('../services/orderStatusEmail');
const { changeStatus } = require('../services/orderStatusService');

test('completion saves paid atomically; other statuses preserve payment', async () => {
  const original = { start: mongoose.startSession, update: Order.findOneAndUpdate, enqueue: emails.enqueue };
  const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
  let expected;
  mongoose.startSession = async () => session;
  Order.findOneAndUpdate = (filter, update, options) => {
    assert.deepEqual(update.$set, expected);
    assert.equal(options.session, session);
    assert.equal(options.runValidators, true);
    assert.ok(filter.status.$nin.includes('cancelled'));
    return { lean: async () => ({ _id: 'order', ...update.$set }) };
  };
  emails.enqueue = async (order, activeSession) => {
    assert.equal(activeSession, session);
    assert.deepEqual(order, { _id: 'order', ...expected });
    return null;
  };
  try {
    for (const status of ['delivered', 'completed', 'shipped', 'processing']) {
      expected = ['delivered', 'completed'].includes(status) ? { status: 'delivered', paymentStatus: 'paid' } : { status };
      assert.deepEqual(await changeStatus('order', status), { _id: 'order', ...expected });
    }
  } finally {
    mongoose.startSession = original.start;
    Order.findOneAndUpdate = original.update;
    emails.enqueue = original.enqueue;
  }
});
