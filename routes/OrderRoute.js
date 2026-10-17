const express = require('express');
const { getOrder, getOrderById, updateOrder } = require('../controllers/OrderController');
const router = express.Router();

router.get('/', getOrder);
router.get('/:id', getOrderById);
router.put('/:id', updateOrder);

module.exports = router;
