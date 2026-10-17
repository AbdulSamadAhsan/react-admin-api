const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'store' },
    storeName: { type: String, required: true, trim: true, maxlength: 35 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    currency: { type: String, enum: ['USD'], default: 'USD' }
}, { timestamps: true, versionKey: false });
module.exports = { StoreSettings: mongoose.model('StoreSettings', schema) };
