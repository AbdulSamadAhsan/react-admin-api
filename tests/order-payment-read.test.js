const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Order } = require('../models/OrderModel');
const { getOrder, getOrderById } = require('../controllers/OrderController');
afterEach(() => mock.restoreAll());
test('admin list persists reconciliation and detail returns the actual saved payment', async () => {
  let stored = { _id: 'cccccccccccccccccccccccc', customer: { name: 'Buyer' }, items: [], paymentMethod: 'cash_on_delivery', status: 'delivered', paymentStatus: 'unpaid', total: 284.12 };
  mock.method(Order, 'find', () => ({ sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [{ ...stored }] }));
  mock.method(Order, 'countDocuments', async () => 1);
  mock.method(Order, 'findById', () => ({ lean: async () => ({ ...stored }) }));
  const write = mock.method(Order, 'findOneAndUpdate', () => {
    stored = { ...stored, paymentStatus: 'paid' };
    return { lean: async () => ({ ...stored }) };
  });
  let payload;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(value) { payload = value; return this; } };
  await getOrder({ query: {} }, res);
  assert.equal(payload.orders[0].paymentStatus, 'paid');
  assert.equal(stored.paymentStatus, 'paid');
  await getOrderById({ params: { id: stored._id } }, res);
  assert.equal(payload.order.paymentStatus, 'paid');
  assert.equal(payload.order.total, 284.12);
  assert.equal(write.mock.callCount(), 1);
});
