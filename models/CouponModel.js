const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0 },
  minSubtotal: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false, collection: 'coupons' });
module.exports = { Coupon: mongoose.models.Coupon || mongoose.model('Coupon', schema) };
