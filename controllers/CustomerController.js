const { CustomerAccount } = require('../models/CustomerAccountModel');
const { Order } = require('../models/OrderModel');
const { normalizeOrder } = require('../services/OrderService');

// Customers are derived from checkout orders; no duplicate customer collection.
const getCustomers = async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1, _id: -1 }).lean();
        const userIds = [...new Set(orders.map(order => String(order.user || '')).filter(id => /^[a-f0-9]{24}$/i.test(id)))];
        const accounts = userIds.length ? await CustomerAccount.find({ _id: { $in: userIds } }).select('_id').lean() : [];
        const activeIds = new Set(accounts.map(account => String(account._id)));
        const grouped = new Map();
        for (const document of orders) {
            const order = normalizeOrder(document);
            const email = order.customer.email.toLowerCase() || String(document.user || document._id);
            const userId = String(document.user || '');
            const linkedAccount = /^[a-f0-9]{24}$/i.test(userId);
            const identity = linkedAccount ? userId : email;
            let customer = grouped.get(identity);
            if (!customer) {
                customer = { id: identity, accountStatus: linkedAccount ? (activeIds.has(userId) ? 'active' : 'deleted') : 'historical', ...order.customer, orders: 0, totalSpent: 0, totalsByCurrency: {}, memberSince: order.createdAt, latestOrder: order };
                grouped.set(identity, customer);
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
