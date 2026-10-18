const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Product } = require('../models/ProductModel');
const { ProductReview } = require('../models/ProductReviewModel');
const { listProductReviews } = require('../controllers/ProductReviewController');
afterEach(() => mock.restoreAll());
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
async function call(productId = id, page = '1') {
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await listProductReviews({ params: { id: productId }, query: { page } }, res);
  return res;
}
test('invalid IDs and pages do not query reviews', async () => {
  const lookup = mock.method(ProductReview, 'find', () => { throw new Error('Unexpected lookup'); });
  assert.equal((await call('bad')).code, 400);
  for (const page of ['0', '-1', '1.5', 'invalid']) assert.equal((await call(id, page)).code, 400);
  assert.equal(lookup.mock.callCount(), 0);
});
test('admin review pages are scoped to the product with variant and date details', async () => {
  mock.method(Product, 'findById', () => ({ select() { return this; }, lean: async () => ({ _id: id, rating: 4.5 }) }));
  let fields, skip, limit;
  const review = { rating: 4, comment: 'Great', size: 'Large', color: '#000000', createdAt: new Date() };
  const find = mock.method(ProductReview, 'find', () => ({ select(value) { fields = value; return this; }, sort() { return this; }, skip(value) { skip = value; return this; }, limit(value) { limit = value; return this; }, lean: async () => [review] }));
  mock.method(ProductReview, 'countDocuments', async () => 25);
  const res = await call(id, '2');
  assert.deepEqual(find.mock.calls[0].arguments[0], { product: id });
  assert.equal(skip, 20); assert.equal(limit, 20);
  assert.match(fields, /size color order createdAt updatedAt/);
  assert.deepEqual(res.body.reviews, [review]);
  assert.deepEqual(res.body.summary, { rating: 4.5, total: 25 });
  assert.equal(res.body.pagination.pages, 2);
});
test('missing products and database errors return clear errors', async () => {
  mock.method(Product, 'findById', () => ({ select() { return this; }, lean: async () => null }));
  assert.equal((await call()).code, 404);
  Product.findById.mock.mockImplementation(() => { throw new Error('Database unavailable'); });
  assert.equal((await call()).code, 500);
});
