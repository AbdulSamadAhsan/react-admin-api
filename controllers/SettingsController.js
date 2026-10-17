const { StoreSettings } = require('../models/StoreSettingsModel');
const defaults = { storeName: 'Studio Store', contactEmail: 'hello@studiostore.example', currency: 'USD' };
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
    if (!data || Array.isArray(data) || !Object.keys(data).length || Object.keys(data).some(key => !['storeName', 'contactEmail', 'currency'].includes(key)) || typeof data.storeName !== 'string' || !data.storeName.trim() || data.storeName.trim().length > 35 || typeof data.contactEmail !== 'string' || data.contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail.trim()) || data.currency !== 'USD') {
        return res.status(400).json({ success: false, message: 'Provide storeName (1-35 characters), a valid contactEmail, and USD currency' });
    }
    try {
        const settings = await StoreSettings.findOneAndUpdate({ key: 'store' }, { $set: { storeName: data.storeName.trim(), contactEmail: data.contactEmail.trim(), currency: data.currency } }, { upsert: true, new: true, runValidators: true });
        return res.json({ success: true, settings });
    } catch (error) {
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: 'Failed to save settings' });
    }
};
module.exports = { getSettings, updateSettings };
