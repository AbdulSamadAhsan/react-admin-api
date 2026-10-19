const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Order } = require('../models/OrderModel');
const { OrderStatusEmail } = require('../models/OrderStatusEmail');
const emails = require('../services/orderStatusEmail');
const smtp = require('../services/smtpService');
const { changeStatus } = require('../services/orderStatusService');
test('status notification uses escaped content and both order formats', async () => {
  const original = OrderStatusEmail.create;
  let saved;
  OrderStatusEmail.create = async (rows, options) => { saved = rows[0]; assert.equal(options.session, 'session'); return [{ _id: 'job' }]; };
  try {
    await emails.enqueue({ _id: 'order', status: 'shipped', shipping: { email: 'buyer@example.com', firstName: '<Buyer>' } }, 'session');
    const message = emails.message({ ...saved, changedAt: new Date('2026-10-18T12:00:00Z') });
    assert.equal(message.to, 'buyer@example.com');
    assert.match(message.text, /Shipped/);
    assert.match(message.html, /&lt;Buyer&gt;/);
    assert.match(message.text, /12:00:00 UTC/);
    await emails.enqueue({ _id: 'legacy', status: 'delivered', customer: { email: 'legacy@example.com', name: 'Buyer' } }, 'session');
    assert.equal(saved.recipient, 'legacy@example.com');
    assert.equal(await emails.enqueue({ shipping: {} }, 'session'), null);
  } finally { OrderStatusEmail.create = original; }
});
test('changed status queues atomically, sends after commit, and unchanged status sends nothing', async () => {
  const original = { start: mongoose.startSession, update: Order.findOneAndUpdate, find: Order.findById, enqueue: emails.enqueue, deliver: emails.deliver };
  let committed = false, changed = true, queued = 0, delivered = 0;
  const session = { async withTransaction(fn) { await fn(); committed = true; }, async endSession() {} };
  mongoose.startSession = async () => session;
  Order.findOneAndUpdate = (filter, update, options) => { assert.equal(options.session, session); return { lean: async () => changed ? { _id: 'order', status: 'shipped' } : null }; };
  Order.findById = () => ({ session() { return this; }, lean: async () => ({ status: 'shipped' }) });
  emails.enqueue = async () => { assert.equal(committed, false); queued++; return 'job'; };
  emails.deliver = async () => { assert.equal(committed, true); delivered++; };
  try {
    await changeStatus('order', 'shipped');
    assert.equal(queued, 1); assert.equal(delivered, 1);
    changed = false; committed = false;
    await changeStatus('order', 'shipped');
    assert.equal(queued, 1); assert.equal(delivered, 1);
  } finally { mongoose.startSession = original.start; Order.findOneAndUpdate = original.update; Order.findById = original.find; emails.enqueue = original.enqueue; emails.deliver = original.deliver; }
});
test('SMTP failure is recorded without throwing; already sent events are not resent', async () => {
  const original = { configuration: smtp.configuration, send: smtp.send, claim: OrderStatusEmail.findOneAndUpdate, update: OrderStatusEmail.updateOne };
  const updates = [];
  smtp.configuration = () => ({});
  smtp.send = async () => { throw Object.assign(new Error('Unavailable'), { code: 'ECONNECTION' }); };
  OrderStatusEmail.findOneAndUpdate = async () => ({ order: 'order', orderStatus: 'shipped', recipient: 'buyer@example.com', changedAt: new Date() });
  OrderStatusEmail.updateOne = async (filter, update) => { updates.push(update); };
  try {
    assert.equal((await emails.deliver('job')).status, 'failed');
    assert.equal(updates[0].$set.lastErrorCode, 'ECONNECTION');
    OrderStatusEmail.findOneAndUpdate = async () => null;
    assert.equal((await emails.deliver('job')).status, 'already_sent_or_not_due');
  } finally { smtp.configuration = original.configuration; smtp.send = original.send; OrderStatusEmail.findOneAndUpdate = original.claim; OrderStatusEmail.updateOne = original.update; }
});
