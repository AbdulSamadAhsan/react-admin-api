const { reconcileCompletedPayment } = require('../services/orderPaymentPolicy');
const { Order } = require('../models/OrderModel');
const { normalizeOrder } = require('../services/OrderService');
const { changeStatus } = require('../services/orderStatusService');

const getOrder = async (req, res) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) {
        return res.status(400).json({ success: false, message: 'Use a positive page and a limit between 1 and 100' });
    }
    try {
        const [orders, total] = await Promise.all([
            Order.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Order.countDocuments()
        ]);
        return res.status(200).json({ success: true, message: 'Orders fetched successfully', orders: (await Promise.all(orders.map(order => reconcileCompletedPayment(order)))).filter(Boolean).map(normalizeOrder), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch {
        return res.status(500).json({ success: false, message: 'Failed to fetch orders' });
    }
};

const updateOrder = async (req, res) => {
    const { id } = req.params;
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return res.status(400).json({ success: false, message: 'Invalid order ID' });
    const data = req.body;
    const allowed = ['status'];
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length || Object.keys(data).some(key => !allowed.includes(key) || typeof data[key] !== 'string')) {
        return res.status(400).json({ success: false, message: 'Provide only status as a string' });
    }
    if (data.status === 'completed') data.status = 'delivered';
    try {
        const order = await changeStatus(id, data.status);
        if (!order) {
            const existing = await Order.findById(id).lean();
            if (['delivered', 'completed', 'cancelled'].includes(existing?.status)) return res.status(409).json({ success: false, message: 'Delivered, completed, and cancelled orders cannot change status.' });
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        return res.status(200).json({ success: true, message: 'Order updated successfully', data: normalizeOrder(order), order: normalizeOrder(order) });
    } catch (error) {
        const invalid = error.name === 'ValidationError' || error.name === 'CastError';
        return res.status(error.status === 409 ? 409 : invalid ? 400 : 500).json({ success: false, message: error.status === 409 ? error.message : invalid ? 'Invalid order fields' : 'Failed to update order' });
    }
};

const getOrderById = async (req, res) => {
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid order ID' });
    try {
        const order = await Order.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        return res.json({ success: true, order: normalizeOrder(await reconcileCompletedPayment(order)) });
    } catch {
        return res.status(500).json({ success: false, message: 'Failed to fetch order' });
    }
};
module.exports = { getOrder, getOrderById, updateOrder };
