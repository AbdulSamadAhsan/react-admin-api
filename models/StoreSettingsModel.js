const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'store' },
    storeName: { type: String, required: true, trim: true, maxlength: 35 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    currency: { type: String, enum: ['USD', 'PKR'], default: 'USD' },
    exchangeRate: { type: Number, min: 0.000001, max: 1000000, default: 1 },
    pkrExchangeRate: { type: Number, min: 0.000001, max: 1000000 }
}, { timestamps: true, versionKey: false });
module.exports = { StoreSettings: mongoose.model('StoreSettings', schema) };
