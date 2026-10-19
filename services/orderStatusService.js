const mongoose = require('mongoose');
const { Order } = require('../models/OrderModel');
const { cancelOrder } = require('./OrderService');
const emails = require('./orderStatusEmail');
async function changeStatus(id, status) {
  let jobId, order;
  if (status === 'cancelled') {
    order = await cancelOrder(id, async (changed, session) => { jobId = await emails.enqueue(changed, session); });
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        jobId = null;
        order = await Order.findOneAndUpdate({ _id: id, status: { $nin: ['delivered', 'completed', 'cancelled', status] } }, { $set: { status } }, { new: true, runValidators: true, session }).lean();
        if (order) jobId = await emails.enqueue(order, session);
        else {
          const existing = await Order.findById(id).session(session).lean();
          if (existing?.status === status) order = existing;
        }
      });
    } finally { await session.endSession(); }
  }
  if (jobId) await emails.deliver(jobId);
  return order;
}
module.exports = { changeStatus };
