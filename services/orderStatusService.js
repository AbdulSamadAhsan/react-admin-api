const { reconcileCompletedPayment } = require('./orderPaymentPolicy');
const mongoose = require('mongoose');
const { Order } = require('../models/OrderModel');
const { cancelOrder } = require('./OrderService');
const emails = require('./orderStatusEmail');
async function changeStatus(id, status) {
  if (status === 'completed') status = 'delivered';
  let jobId, order;
  if (status === 'cancelled') {
    order = await cancelOrder(id, async (changed, session) => { jobId = await emails.enqueue(changed, session); });
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        jobId = null;
        const fields = { status };
        order = await Order.findOneAndUpdate({ _id: id, status: { $nin: ['delivered', 'completed', 'cancelled', status] } }, { $set: fields }, { new: true, runValidators: true, session }).lean();
        if (order) {
          order = await reconcileCompletedPayment(order, {}, session);
          jobId = await emails.enqueue(order, session);
        }
        else {
          const existing = await Order.findById(id).session(session).lean();
          if (existing?.status === status || (status === 'delivered' && existing?.status === 'completed')) order = await reconcileCompletedPayment(existing, {}, session);
        }
      });
    } finally { await session.endSession(); }
  }
  if (jobId) await emails.deliver(jobId);
  return order;
}
module.exports = { changeStatus };
