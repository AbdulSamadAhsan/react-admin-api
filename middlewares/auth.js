const connectDb = require('../config/db');
const { Admin } = require('../models/AdminModel');
const service = require('../services/AdminService');

async function authenticate(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!match) return res.status(401).json({ success: false, message: 'Authentication required' });
    try { service.jwtSecret(); }
    catch { return res.status(503).json({ success: false, message: 'Authentication is not configured' }); }
    let claims;
    try {
        claims = service.verifyToken(match[1]);
        if (typeof claims.sub !== 'string' || !/^[a-fA-F0-9]{24}$/.test(claims.sub)) throw new Error('Invalid subject');
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
    }
    try {
        await connectDb();
        const admin = await Admin.findById(claims.sub).select("+sessionVersion");
        if (!admin || !admin.active) return res.status(401).json({ success: false, message: 'Account unavailable' });
        if ((claims.v || 0) !== (admin.sessionVersion || 0)) return res.status(401).json({ success: false, message: 'Account credentials changed. Sign in again' });
        req.admin = admin;
        next();
    } catch {
        return res.status(503).json({ success: false, message: 'Authentication temporarily unavailable' });
    }
}

const authorize = (...roles) => (req, res, next) => {
    if (!req.admin) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!roles.includes(req.admin.role)) return res.status(403).json({ success: false, message: 'Admin access required' });
    next();
};

module.exports = { authenticate, authorize };
