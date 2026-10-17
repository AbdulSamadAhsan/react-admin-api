const express = require('express');
const { getOrder, getOrderById, updateOrder } = require('../controllers/OrderController');
const router = express.Router();

const { authenticate, authorize } = require('../middlewares/auth');
router.use(authenticate, authorize('admin'));
router.get('/', getOrder);
router.get('/:id', getOrderById);
router.put('/:id', updateOrder);

module.exports = router;
