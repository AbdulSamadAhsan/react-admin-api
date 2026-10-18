const { Coupon } = require('../models/CouponModel');
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
function couponInput(body) {
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) fail('Use a code of 3–40 letters, numbers, hyphens or underscores');
  if (!['percentage', 'fixed'].includes(body.type)) fail('Choose percentage or fixed discount');
  const value = body.value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > (body.type === 'percentage' ? 100 : 1000000) || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) fail('Enter a positive discount with up to two decimal places (percentage maximum: 100)');
  const minSubtotal = body.minSubtotal ?? 0;
  if (typeof minSubtotal !== 'number' || !Number.isFinite(minSubtotal) || minSubtotal < 0 || minSubtotal > 1000000 || Math.abs(minSubtotal * 100 - Math.round(minSubtotal * 100)) > 0.00001) fail('Enter a valid minimum subtotal with up to two decimal places');
  if (typeof body.active !== 'boolean') fail('Choose whether the coupon is active');
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || typeof body.expiresAt !== 'string')) fail('Enter a valid expiry date');
  return { code, type: body.type, value, minSubtotal, active: body.active, expiresAt };
}
function errorResponse(error, res) {
  const status = error.code === 11000 ? 409 : error.status || 500;
  return res.status(status).json({ success: false, message: error.code === 11000 ? 'That coupon code already exists' : status === 500 ? 'Could not save coupons. Please try again.' : error.message });
}
async function listCoupons(req, res) {
  try {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) fail('Invalid page');
    const search = String(req.query.search || '').trim().slice(0, 40).toUpperCase();
    const filter = search ? { code: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } } : {};
    const [coupons, total] = await Promise.all([Coupon.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean(), Coupon.countDocuments(filter)]);
    res.json({ success: true, coupons, pagination: { page, total, pages: Math.ceil(total / 20) } });
  } catch (error) { errorResponse(error, res); }
}
async function saveCoupon(req, res) {
  try {
    if (req.params.id && !/^[a-f\d]{24}$/i.test(req.params.id)) fail('Invalid coupon ID');
    const values = couponInput(req.body);
    const coupon = req.params.id ? await Coupon.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true }) : await Coupon.create(values);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.status(req.params.id ? 200 : 201).json({ success: true, coupon });
  } catch (error) { errorResponse(error, res); }
}
async function deleteCoupon(req, res) {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) fail('Invalid coupon ID');
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true });
  } catch (error) { errorResponse(error, res); }
}
module.exports = { listCoupons, saveCoupon, deleteCoupon, couponInput };
