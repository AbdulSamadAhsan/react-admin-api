const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, required: true },
  orderStatus: { type: String, required: true },
  recipient: { type: String, required: true },
  customerName: String,
  changedAt: { type: Date, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'sending', 'sent', 'failed'] },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  lockedUntil: Date,
  sentAt: Date,
  lastErrorCode: String,
}, { timestamps: true, versionKey: false });
schema.index({ status: 1, nextAttemptAt: 1 });
module.exports = { OrderStatusEmail: mongoose.model('OrderStatusEmail', schema) };
