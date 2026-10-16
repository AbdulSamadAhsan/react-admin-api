const express = require('express');
const { registerAdmin, loginAdmin, getAdmin } = require('../controllers/AdminController');
const { authenticate, authorize } = require('../middlewares/auth');
const router = express.Router();
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.get('/me', authenticate, authorize('admin'), getAdmin);
module.exports = router;
