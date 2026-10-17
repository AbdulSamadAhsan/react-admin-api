const { Order } = require('../models/OrderModel');
const { normalizeOrder } = require('../services/OrderService');

// Customers are derived from checkout orders; no duplicate customer collection.
const getCustomers = async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1, _id: -1 }).lean();
        const grouped = new Map();
        for (const document of orders) {
            const order = normalizeOrder(document);
            const email = order.customer.email.toLowerCase() || String(document.user || document._id);
            let customer = grouped.get(email);
            if (!customer) {
                customer = { id: email, ...order.customer, orders: 0, totalSpent: 0, totalsByCurrency: {}, memberSince: order.createdAt, latestOrder: order };
                grouped.set(email, customer);
            }
            customer.orders++;
            if (order.status !== 'cancelled') {
                customer.totalSpent += order.total;
                customer.totalsByCurrency[order.currency] = (customer.totalsByCurrency[order.currency] || 0) + order.total;
            }
            if (order.createdAt < customer.memberSince) customer.memberSince = order.createdAt;
        }
        return res.json({ success: true, customers: [...grouped.values()] });
    } catch {
        return res.status(500).json({ success: false, message: 'Failed to fetch customers' });
    }
};
module.exports = { getCustomers };
