const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    price: { type: Number, required: true, min: 0 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, trim: true },
    customer: {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        phone: { type: String, trim: true, default: '' }
    },
    shippingAddress: {
        address: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        postalCode: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' }
    },
    items: { type: [orderItemSchema], validate: { validator: items => items.length > 0, message: 'Order must contain at least one item' } },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, match: /^[A-Z]{3}$/ },
    status: { type: String, enum: ['awaiting_payment', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    trackingNumber: { type: String, trim: true, maxlength: 200, default: '' },
    adminNotes: { type: String, trim: true, maxlength: 2000, default: '' }
}, { timestamps: true, versionKey: false });

orderSchema.index({ createdAt: -1, _id: -1 });
module.exports = { Order: mongoose.model('Order', orderSchema) };
