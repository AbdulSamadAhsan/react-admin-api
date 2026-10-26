const { StoreSettings } = require('../models/StoreSettingsModel');
const defaults = { storeName: 'Studio Store', contactEmail: 'hello@studiostore.example', currency: 'USD', exchangeRate: 1 };
const currencies = ['USD', 'PKR', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'CAD', 'AUD'];
const getSettings = async (req, res) => {
    try {
        const settings = await StoreSettings.findOne({ key: 'store' });
        return res.json({ success: true, settings: settings || defaults });
    } catch {
        return res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
};
const updateSettings = async (req, res) => {
    const data = req.body;
    const rate = data?.exchangeRate ?? (data?.currency === 'USD' ? 1 : undefined);
    if (!data || Array.isArray(data) || !Object.keys(data).length || Object.keys(data).some(key => !['storeName', 'contactEmail', 'currency', 'exchangeRate'].includes(key)) || typeof data.storeName !== 'string' || !data.storeName.trim() || data.storeName.trim().length > 35 || typeof data.contactEmail !== 'string' || data.contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail.trim()) || !currencies.includes(data.currency) || typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0.000001 || rate > 1000000 || (data.currency === 'USD' && rate !== 1)) {
        return res.status(400).json({ success: false, message: 'Provide store details, a supported currency, and a positive exchange rate (1 USD equals this amount). USD must use rate 1.' });
    }
    try {
        const settings = await StoreSettings.findOneAndUpdate({ key: 'store' }, { $set: { storeName: data.storeName.trim(), contactEmail: data.contactEmail.trim(), currency: data.currency, exchangeRate: rate } }, { upsert: true, new: true, runValidators: true });
        return res.json({ success: true, settings });
    } catch (error) {
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: 'Failed to save settings' });
    }
};
module.exports = { getSettings, updateSettings };
