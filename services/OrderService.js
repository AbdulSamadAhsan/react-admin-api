// Read both the checkout order format and the original admin format.
// Responses deliberately omit checkout idempotency and payment-provider secrets.
function normalizeOrder(document) {
    const order = document.toObject ? document.toObject() : document;
    const shipping = order.shipping || {};
    const customer = order.customer || {};
    return {
        _id: order._id,
        orderNumber: order.orderNumber || String(order._id),
        customer: {
            name: customer.name || [shipping.firstName, shipping.lastName].filter(Boolean).join(' ') || 'Customer',
            email: customer.email || shipping.email || '',
            phone: customer.phone || shipping.phone || ''
        },
        shippingAddress: {
            address: order.shippingAddress?.address || shipping.address || '',
            city: order.shippingAddress?.city || shipping.city || '',
            state: order.shippingAddress?.state || shipping.state || '',
            postalCode: order.shippingAddress?.postalCode || shipping.zip || '',
            country: order.shippingAddress?.country || shipping.country || ''
        },
        items: (order.items || []).map(item => ({
            product: item.product || item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: item.image || '',
            size: item.size || '',
            color: item.color || ''
        })),
        subtotal: order.subtotal,
        discount: order.discount || 0,
        deliveryFee: order.deliveryFee || 0,
        total: order.total,
        currency: order.currency || 'USD',
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
    };
}
module.exports = { normalizeOrder };


// Use one transaction so status and inventory either both commit or neither does.
async function cancelOrder(id) {
    const mongoose = require('mongoose');
    const { Order } = require('../models/OrderModel');
    const { Product } = require('../models/ProductModel');
    const session = await mongoose.startSession();
    let order;
    try {
        await session.withTransaction(async () => {
            order = await Order.findOneAndUpdate(
                { _id: id, status: { $nin: ['delivered', 'completed', 'cancelled'] } },
                { $set: { status: 'cancelled' } },
                { new: true, runValidators: true, session }
            ).lean();
            if (!order) {
                order = await Order.findById(id).session(session).lean();
                if (order && ['delivered', 'completed'].includes(order.status)) {
                    throw Object.assign(new Error('Delivered or completed orders cannot change status.'), { status: 409 });
                }
                return;
            }
            for (const item of order.items || []) {
                const productId = item.product || item.productId;
                // Historical orders can refer to products that have since been deleted.
                if (!productId) continue;
                if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
                    throw new Error('Invalid order quantity');
                }
                await Product.updateOne(
                    { _id: productId }, { $inc: { stock: item.quantity } }, { session }
                );
            }
        });
        return order;
    } finally {
        await session.endSession();
    }
}
module.exports.cancelOrder = cancelOrder;
