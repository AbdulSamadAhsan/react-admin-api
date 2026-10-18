const { Product } = require('../models/ProductModel');
const { ProductReview } = require('../models/ProductReviewModel');

async function listProductReviews(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid product ID' });
  const page = Number(req.query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ success: false, message: 'Invalid review page' });
  try {
    const product = await Product.findById(req.params.id).select('name rating').lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const filter = { product: product._id };
    const limit = 20;
    const [reviews, total] = await Promise.all([
      ProductReview.find(filter).select('name rating comment size color order createdAt updatedAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProductReview.countDocuments(filter),
    ]);
    return res.json({ success: true, reviews, summary: { rating: product.rating ?? 5, total }, pagination: { page, pages: Math.ceil(total / limit), total } });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to load product reviews' });
  }
}
module.exports = { listProductReviews };
