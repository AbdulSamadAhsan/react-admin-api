const path = require('path');
require('dotenv').config({ path: [path.join(__dirname, '.env.local'), path.join(__dirname, '.env')], quiet: true });
const express = require('express');
const connectDb = require('./config/db');
const productRoutes = require('./routes/ProductRoute');
const adminRoutes = require('./routes/AdminRoute');
const orderRoutes = require('./routes/OrderRoute');
const { uploadPath } = require('./middlewares/upload');
const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,http://127.0.0.1:5176,http://localhost:3000,https://react-admin-panel-hazel.vercel.app,https://ecommercedashboard-amber.vercel.app').split(',').map(value => value.trim());
app.use(require('cors')({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadPath));
app.get('/', (req, res) => res.json({ success: true, message: 'API is running' }));
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', require('./routes/CustomerRoute'));
app.use('/api/settings', require('./routes/SettingsRoute'));
app.use((error, req, res, next) => {
    const uploadError = error.name === 'MulterError';
    const badRequest = error.status === 400;
    res.status(uploadError || badRequest ? 400 : 500).json({ success: false, message: uploadError ? error.message : badRequest ? 'Invalid request body' : 'Request failed' });
});
if (require.main === module) {
    connectDb().then(() => app.listen(process.env.PORT || 5000, () => console.log('API listening on port ' + (process.env.PORT || 5000))))
        .catch(error => {
            console.error('Database startup failed (' + error.name + '). Check MONGO_URI: use one database name, valid credentials, and permitted network access.');
            process.exitCode = 1;
        });
}
module.exports = app;
