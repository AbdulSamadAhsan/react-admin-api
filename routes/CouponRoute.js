const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth');
const { listCoupons, saveCoupon, deleteCoupon } = require('../controllers/CouponController');
router.use(authenticate, authorize('admin'));
router.get('/', listCoupons);
router.post('/', saveCoupon);
router.put('/:id', saveCoupon);
router.delete('/:id', deleteCoupon);
module.exports = router;
