const router = require('express').Router();
const { getSettings, updateSettings } = require('../controllers/SettingsController');
const { authenticate, authorize } = require('../middlewares/auth');
router.use(authenticate, authorize('admin'));
router.get('/', getSettings);
router.put('/', updateSettings);
module.exports = router;
