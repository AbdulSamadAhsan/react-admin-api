const { OrderStatusEmail } = require('../models/OrderStatusEmail');
const smtp = require('./smtpService');
const labels = { awaiting_payment: 'Awaiting payment', pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function message(job) {
  const label = labels[job.orderStatus] || job.orderStatus;
  const id = String(job.order);
  const date = new Date(job.changedAt).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  const text = `Hi ${job.customerName || 'Customer'},\n\nYour SHOP.CO order #${id} is now ${label}.\nUpdated: ${date}\n\nView your order: https://reactshopco.vercel.app/account`;
  return { to: job.recipient, subject: `SHOP.CO order #${id}: ${label}`, text,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h1>SHOP.CO</h1><h2>Order status updated</h2><p>Hi ${escape(job.customerName || 'Customer')},</p><p>Your order <strong>#${escape(id)}</strong> is now <strong>${escape(label)}</strong>.</p><p>Updated: ${escape(date)}</p><p><a href="https://reactshopco.vercel.app/account">View your order</a></p></div>` };
}
async function enqueue(order, session) {
  const recipient = order.customer?.email || order.shipping?.email;
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || /[\r\n]/.test(recipient)) return null;
  const [job] = await OrderStatusEmail.create([{
    order: order._id, orderStatus: order.status, recipient,
    customerName: order.customer?.name || [order.shipping?.firstName, order.shipping?.lastName].filter(Boolean).join(' '),
    changedAt: order.updatedAt || new Date(),
  }], { session });
  return job._id;
}
async function deliver(id) {
  if (!smtp.configuration()) return { status: 'not_configured' };
  let job;
  try {
    const now = new Date();
    job = await OrderStatusEmail.findOneAndUpdate({ _id: id, attempts: { $lt: 5 }, $or: [
      { status: { $in: ['pending', 'failed'] }, nextAttemptAt: { $lte: now } },
      { status: 'sending', lockedUntil: { $lt: now } },
    ] }, { $set: { status: 'sending', lockedUntil: new Date(Date.now() + 300000) }, $inc: { attempts: 1 } }, { new: true });
    if (!job) return { status: 'already_sent_or_not_due' };
    await smtp.send(message(job));
    await OrderStatusEmail.updateOne({ _id: id, status: 'sending' }, { $set: { status: 'sent', sentAt: new Date() }, $unset: { lockedUntil: 1, lastErrorCode: 1 } });
    return { status: 'sent' };
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'EMAIL_DELIVERY_FAILED';
    if (job) await OrderStatusEmail.updateOne({ _id: id, status: 'sending' }, { $set: { status: 'failed', lastErrorCode: code, nextAttemptAt: new Date(Date.now() + 5 * 60000) }, $unset: { lockedUntil: 1 } }).catch(() => {});
    console.error('Order status email failed:', code);
    return { status: 'failed' };
  }
}
async function retryPending(limit = 10) {
  const jobs = await OrderStatusEmail.find({ attempts: { $lt: 5 }, $or: [
    { status: { $in: ['pending', 'failed'] }, nextAttemptAt: { $lte: new Date() } },
    { status: 'sending', lockedUntil: { $lt: new Date() } },
  ] }).sort({ createdAt: 1 }).limit(limit).select('_id').lean();
  for (const job of jobs) await deliver(job._id);
  return { processed: jobs.length };
}
module.exports = { enqueue, deliver, retryPending, message };
