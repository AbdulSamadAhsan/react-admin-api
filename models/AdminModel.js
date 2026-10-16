const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'viewer'], default: 'admin' },
    active: { type: Boolean, default: true }
}, { timestamps: true });

adminSchema.set('toJSON', { transform: (doc, result) => {
    delete result.password;
    delete result.__v;
    return result;
} });

module.exports = { Admin: mongoose.model('Admin', adminSchema) };
