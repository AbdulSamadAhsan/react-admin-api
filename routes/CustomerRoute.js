const router = require('express').Router();
const { getCustomers } = require('../controllers/CustomerController');
const { authenticate, authorize } = require('../middlewares/auth');
router.use(authenticate, authorize('admin'));
router.get('/', getCustomers);
module.exports = router;
