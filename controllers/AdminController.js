const bcrypt = require('bcryptjs');
const { Admin } = require('../models/AdminModel');
const connectDb = require('../config/db');
const service = require('../services/AdminService');

const emailValue = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = password => typeof password === 'string' && password.length >= 6 && Buffer.byteLength(password, 'utf8') <= 72;
// A dummy hash keeps unknown-account login checks on the same password-hashing path.
const dummyHash = bcrypt.hashSync('dummy-password-not-for-login', 12);

async function registerAdmin(req, res) {
    res.set('Cache-Control', 'no-store');
    if (!service.registrationAllowed(req.get('x-admin-registration-key'))) {
        return res.status(403).json({ success: false, message: 'Admin registration requires a valid setup key' });
    }
    const { name, email: rawEmail, password } = req.body || {};
    const email = emailValue(rawEmail);
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !validEmail(email) || !validPassword(password)) {
        return res.status(400).json({ success: false, message: 'Provide name (1–100 characters), valid email, and password (at least 6 characters, at most 72 UTF-8 bytes)' });
    }
    try {
        service.jwtSecret();
        await connectDb();
        if (!(await service.consumeAttempt('register', 'admin', 20))) {
            res.set('Retry-After', '900');
            return res.status(429).json({ success: false, message: 'Too many registration attempts. Try again later' });
        }
        const admin = await Admin.create({ name: name.trim(), email, password: await bcrypt.hash(password, 12), role: 'admin', active: true });
        return res.status(201).json({ success: true, message: 'Admin registered successfully', admin: service.publicAdmin(admin), token: service.issueToken(admin), tokenType: 'Bearer', expiresIn: 3600 });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'Email is already registered' });
        return res.status(503).json({ success: false, message: 'Registration temporarily unavailable. Check server configuration' });
    }
}

async function loginAdmin(req, res) {
    res.set('Cache-Control', 'no-store');
    const email = emailValue(req.body?.email);
    const password = req.body?.password;
    if (!validEmail(email) || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
        return res.status(400).json({ success: false, message: 'Provide a valid email and password' });
    }
    try {
        service.jwtSecret();
        await connectDb();
        if (!(await service.consumeAttempt('login', email, 10))) {
            res.set('Retry-After', '900');
            return res.status(429).json({ success: false, message: 'Too many login attempts. Try again later' });
        }
        const admin = await Admin.findOne({ email }).select('+password +sessionVersion');
        const matches = await bcrypt.compare(password, admin?.password || dummyHash);
        if (!admin || !matches || !admin.active || admin.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        return res.status(200).json({ success: true, message: 'Logged in successfully', admin: service.publicAdmin(admin), token: service.issueToken(admin), tokenType: 'Bearer', expiresIn: 3600 });
    } catch {
        return res.status(503).json({ success: false, message: 'Login temporarily unavailable. Check server configuration' });
    }
}

const getAdmin = (req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, admin: service.publicAdmin(req.admin) });
};

async function updateAdmin(req, res) {
    res.set('Cache-Control', 'no-store');
    const body = req.body;
    if (!body || Array.isArray(body) || Object.keys(body).some(key => !['email', 'currentPassword', 'newPassword'].includes(key)) || typeof body.currentPassword !== 'string' || !body.currentPassword || Buffer.byteLength(body.currentPassword) > 72 || (body.email === undefined && body.newPassword === undefined)) {
        return res.status(400).json({ success: false, message: 'Provide your current password and a new email or password' });
    }
    const email = body.email === undefined ? undefined : emailValue(body.email);
    if ((email !== undefined && !validEmail(email)) || (body.newPassword !== undefined && !validPassword(body.newPassword))) {
        return res.status(400).json({ success: false, message: 'Use a valid email and a new password of at least 6 characters (maximum 72 UTF-8 bytes)' });
    }
    try {
        if (!(await service.consumeAttempt('account-update', String(req.admin._id), 10))) {
            res.set('Retry-After', '900');
            return res.status(429).json({ success: false, message: 'Too many attempts. Try again later' });
        }
        const admin = await Admin.findById(req.admin._id).select('+password +sessionVersion');
        if (!admin || !await bcrypt.compare(body.currentPassword, admin.password)) return res.status(403).json({ success: false, message: 'Current password is incorrect' });
        if (body.newPassword !== undefined && await bcrypt.compare(body.newPassword, admin.password)) return res.status(400).json({ success: false, message: 'Choose a different new password' });
        if (body.newPassword === undefined && email === admin.email) return res.status(400).json({ success: false, message: 'Enter a different email or a new password' });
        const changes = {};
        if (email !== undefined) changes.email = email;
        if (body.newPassword !== undefined) changes.password = await bcrypt.hash(body.newPassword, 12);
        const version = admin.sessionVersion || 0;
        const versionFilter = version === 0 ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] } : { sessionVersion: version };
        const updated = await Admin.findOneAndUpdate({ _id: admin._id, password: admin.password, ...versionFilter }, { $set: changes, $inc: { sessionVersion: 1 } }, { new: true, runValidators: true });
        if (!updated) return res.status(409).json({ success: false, message: 'Account changed in another session. Sign in again' });
        return res.json({ success: true, message: 'Account updated. Sign in with your updated credentials', admin: service.publicAdmin(updated) });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'Email is already registered' });
        return res.status(503).json({ success: false, message: 'Account update temporarily unavailable' });
    }
}
module.exports = { registerAdmin, loginAdmin, getAdmin, updateAdmin };
