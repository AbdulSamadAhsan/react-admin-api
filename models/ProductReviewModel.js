const mongoose = require('mongoose');
const schema = new mongoose.Schema({}, { strict: false, collection: 'reviews', autoCreate: false, autoIndex: false });
module.exports = { ProductReview: mongoose.models.ProductReview || mongoose.model('ProductReview', schema) };
