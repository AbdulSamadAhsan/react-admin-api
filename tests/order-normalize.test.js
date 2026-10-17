const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOrder } = require('../services/OrderService');
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
