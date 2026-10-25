const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOrder } = require('../services/OrderService');

test('legacy GST comes from saved totals without assuming a current tax rate', () => {
  const pricing = { subtotal: 290, discount: 58, deliveryFee: 15, total: 284.12 };
  assert.equal(normalizeOrder(pricing).gst, 37.12);
  assert.equal(normalizeOrder({ ...pricing, gst: 0 }).gst, 0);
  assert.equal(normalizeOrder({ ...pricing, total: 247 }).gst, 0);
  assert.equal(normalizeOrder({ ...pricing, total: 200 }).gst, undefined);
  assert.equal(normalizeOrder({ total: 284.12 }).gst, undefined);
});

test('admin preserves saved tax, discount and totals for both supplied pricing examples', () => {
  for (const pricing of [
    { subtotal: 290, discount: 0, gst: 46.4, gstRate: 0.16, deliveryFee: 15, total: 351.4 },
    { subtotal: 290, discount: 58, gst: 37.12, gstRate: 0.16, deliveryFee: 15, total: 284.12 }
  ]) {
    const result = normalizeOrder({ _id: 'order', ...pricing });
    for (const [key, value] of Object.entries(pricing)) assert.equal(result[key], value);
    assert.equal(Math.round((result.subtotal - result.discount + result.gst + result.deliveryFee) * 100), Math.round(result.total * 100));
  }
  assert.equal(normalizeOrder({ _id: 'legacy', total: 10 }).gst, undefined);
});

test('normalization reports stored payment status without inferring a payment', () => {
  for (const status of ['delivered', 'completed']) {
    for (const paymentStatus of ['unpaid', 'pending', undefined, null, '', 'paid']) {
      assert.equal(normalizeOrder({ _id: 'old', status, paymentStatus }).paymentStatus, paymentStatus);
    }
    for (const paymentStatus of ['refunded', 'failed']) {
      assert.equal(normalizeOrder({ _id: 'old', status, paymentStatus }).paymentStatus, paymentStatus);
    }
  }
  for (const status of ['pending', 'processing', 'shipped', 'cancelled']) {
    assert.equal(normalizeOrder({ _id: 'old', status, paymentStatus: 'unpaid' }).paymentStatus, 'unpaid');
  }
});
test('checkout order snapshots map to admin responses without exposing checkout keys', () => {
  const result = normalizeOrder({ _id: 'abc', user: 'user-id', idempotencyKey: 'secret-key', requestHash: 'hash', stripeSessionId: 'stripe', shipping: { firstName: 'Ada', lastName: 'Buyer', email: 'ada@example.com', zip: '12345' }, items: [{ productId: 'product-id', name: 'Shorts', price: 80, quantity: 1, size: 'M', color: 'Green' }], subtotal: 80, discount: 16, deliveryFee: 15, total: 79, currency: 'USD', status: 'pending', paymentStatus: 'unpaid' });
  assert.equal(result.customer.name, 'Ada Buyer');
  assert.equal(result.customer.email, 'ada@example.com');
  assert.equal(result.shippingAddress.postalCode, '12345');
  assert.equal(result.items[0].product, 'product-id');
  assert.equal(result.items[0].size, 'M');
  assert.equal(result.total, 79);
  for (const field of ['user', 'idempotencyKey', 'requestHash', 'stripeSessionId']) assert.equal(result[field], undefined);
});
