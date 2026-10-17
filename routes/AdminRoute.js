const express = require('express');
const { registerAdmin, loginAdmin, getAdmin, updateAdmin } = require('../controllers/AdminController');
const { authenticate, authorize } = require('../middlewares/auth');
const router = express.Router();
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.get('/me', authenticate, authorize('admin'), getAdmin);
router.patch('/me', authenticate, authorize('admin'), updateAdmin);
module.exports = router;
