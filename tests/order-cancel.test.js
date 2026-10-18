const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Order } = require('../models/OrderModel');
const { Product } = require('../models/ProductModel');
const { cancelOrder } = require('../services/OrderService');

test('cancellation restores both order item formats exactly once and rolls back failures', async t => {
  const originals = { start: mongoose.startSession, update: Order.findOneAndUpdate, find: Order.findById, product: Product.updateOne };
  let order, stock, fail, ended;
  const session = {
    async withTransaction(callback) {
      const before = structuredClone({ order, stock });
      try { await callback(); } catch (error) { order = before.order; stock = before.stock; throw error; }
    },
    async endSession() { ended++; }
  };
  mongoose.startSession = async () => session;
  Order.findOneAndUpdate = (filter, update, options) => ({ lean: async () => {
    assert.equal(options.session, session);
    assert.deepEqual(filter.status, { $nin: ['delivered', 'completed', 'cancelled'] });
    if (!order || ['delivered', 'completed', 'cancelled'].includes(order.status)) return null;
    order.status = update.$set.status;
    return structuredClone(order);
  } });
  Order.findById = () => ({ session(received) { assert.equal(received, session); return this; }, lean: async () => order });
  Product.updateOne = async (filter, update, options) => {
    assert.equal(options.session, session);
    if (fail && filter._id === 'b') throw new Error('Database unavailable');
    stock[filter._id] += update.$inc.stock;
    return { modifiedCount: 1 };
  };
  const reset = () => { order = { status: 'processing', items: [{ product: 'a', quantity: 2 }, { productId: 'b', quantity: 3 }, { productId: 'a', quantity: 1 }] }; stock = { a: 4, b: 5 }; ended = 0; fail = false; };
  try {
    await t.test('restores quantities, aggregates repeated products, and ignores repeat cancellation', async () => {
      reset();
      assert.equal((await cancelOrder('id')).status, 'cancelled');
      assert.deepEqual(stock, { a: 7, b: 8 });
      await cancelOrder('id');
      assert.deepEqual(stock, { a: 7, b: 8 });
      assert.equal(ended, 2);
    });
    await t.test('stock failure aborts the status and all stock changes', async () => {
      reset(); fail = true;
      await assert.rejects(cancelOrder('id'), /Database unavailable/);
      assert.equal(order.status, 'processing');
      assert.deepEqual(stock, { a: 4, b: 5 });
      assert.equal(ended, 1);
    });
    await t.test('delivered and completed orders cannot be cancelled or restocked', async () => {
      for (const status of ['delivered', 'completed']) {
        reset(); order.status = status;
        await assert.rejects(cancelOrder('id'), error => error.status === 409);
        assert.equal(order.status, status);
        assert.deepEqual(stock, { a: 4, b: 5 });
      }
    });
    await t.test('already cancelled and missing orders do not restore stock', async () => {
      reset(); order.status = 'cancelled';
      await cancelOrder('id');
      assert.deepEqual(stock, { a: 4, b: 5 });
      order = null;
      assert.equal(await cancelOrder('id'), null);
    });
  } finally {
    mongoose.startSession = originals.start;
    Order.findOneAndUpdate = originals.update;
    Order.findById = originals.find;
    Product.updateOne = originals.product;
  }
});
