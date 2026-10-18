const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Coupon } = require('../models/CouponModel');
const { couponInput, saveCoupon, deleteCoupon } = require('../controllers/CouponController');
afterEach(() => mock.restoreAll());
const input = { code: ' save20 ', type: 'percentage', value: 20, minSubtotal: 0, active: true, expiresAt: null };
const response = () => ({ code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } });
test('coupon validation normalizes codes and rejects invalid discounts and dates', () => {
  assert.equal(couponInput(input).code, 'SAVE20');
  for (const values of [{ value: 101 }, { value: -1 }, { value: 0 }, { value: 1.001 }, { minSubtotal: -1 }, { code: 'bad code' }, { expiresAt: 'invalid' }, { active: 'false' }, { type: 'unknown' }]) assert.throws(() => couponInput({ ...input, ...values }), { status: 400 });
});
test('coupon creation, editing and deletion persist only allowed fields', async () => {
  const create = mock.method(Coupon, 'create', async values => ({ _id: 'id', ...values }));
  let res = response(); await saveCoupon({ body: { ...input, usageCount: 999 }, params: {} }, res);
  assert.equal(res.code, 201); assert.equal(create.mock.calls[0].arguments[0].usageCount, undefined);
  const update = mock.method(Coupon, 'findByIdAndUpdate', async () => ({ _id: 'id' }));
  res = response(); await saveCoupon({ body: { ...input, active: false }, params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } }, res);
  assert.equal(res.code, 200); assert.equal(update.mock.calls[0].arguments[1].$set.active, false);
  mock.method(Coupon, 'findByIdAndDelete', async () => ({}));
  res = response(); await deleteCoupon({ params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } }, res); assert.equal(res.body.success, true);
});
test('duplicate codes and missing coupons return actionable errors', async () => {
  mock.method(Coupon, 'create', async () => { throw Object.assign(new Error('Duplicate'), { code: 11000 }); });
  let res = response(); await saveCoupon({ body: input, params: {} }, res); assert.equal(res.code, 409);
  mock.method(Coupon, 'findByIdAndDelete', async () => null);
  res = response(); await deleteCoupon({ params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } }, res); assert.equal(res.code, 404);
});
