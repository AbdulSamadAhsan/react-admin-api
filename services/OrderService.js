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
