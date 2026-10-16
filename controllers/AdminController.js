const bcrypt = require('bcryptjs');
const { Admin } = require('../models/AdminModel');
const connectDb = require('../config/db');
const service = require('../services/AdminService');

const emailValue = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = password => typeof password === 'string' && password.length >= 15 && Buffer.byteLength(password, 'utf8') <= 72;
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
        return res.status(400).json({ success: false, message: 'Provide name (1–100 characters), valid email, and password (at least 15 characters, at most 72 UTF-8 bytes)' });
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
        const admin = await Admin.findOne({ email }).select('+password');
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

module.exports = { registerAdmin, loginAdmin, getAdmin };
