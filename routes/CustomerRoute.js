const router = require('express').Router();
const { getCustomers } = require('../controllers/CustomerController');
router.get('/', getCustomers);
module.exports = router;
