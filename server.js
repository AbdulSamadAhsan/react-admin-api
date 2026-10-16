const path = require('path');
require('dotenv').config({ path: [path.join(__dirname, '.env.local'), path.join(__dirname, '.env')], quiet: true });
const express = require('express');
const connectDb = require('./config/db');
const productRoutes = require('./routes/ProductRoute');
const { uploadPath } = require('./middlewares/upload');
const app = express();
app.use(require('cors')({ origin: ['http://localhost:5173', 'http://localhost:3000', 'https://react-admin-panel-hazel.vercel.app'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadPath));
app.get('/', (req, res) => res.json({ success: true, message: 'API is running' }));
app.use('/api/products', async (req, res, next) => {
    try { await connectDb(); next(); }
    catch { res.status(503).json({ success: false, message: 'Database unavailable. Check MONGO_URI and database access.' }); }
}, productRoutes);
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
