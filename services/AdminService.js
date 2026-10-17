const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { AuthAttempt } = require('../models/AuthAttemptModel');

const issuer = 'react-admin-api';
const audience = 'react-admin';
function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET must be at least 32 bytes');
    return secret;
}

function issueToken(admin) {
    return jwt.sign({ v: admin.sessionVersion || 0 }, jwtSecret(), {
        algorithm: 'HS256', subject: String(admin._id), issuer, audience, expiresIn: '1h'
    });
}

function verifyToken(token) {
    return jwt.verify(token, jwtSecret(), { algorithms: ['HS256'], issuer, audience });
}

function publicAdmin(admin) {
    return { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role, active: admin.active };
}

function registrationAllowed(key) {
    const expected = process.env.ADMIN_REGISTRATION_KEY;
    if (!expected || Buffer.byteLength(expected) < 32) return false;
    if (typeof key !== 'string') return false;
    return crypto.timingSafeEqual(crypto.createHash('sha256').update(key).digest(), crypto.createHash('sha256').update(expected).digest());
}

// Mongo-backed limits are shared across Vercel instances. Never store raw emails here.
async function consumeAttempt(scope, identity, limit) {
    const windowMs = 15 * 60 * 1000;
    const bucket = Math.floor(Date.now() / windowMs);
    const key = crypto.createHash('sha256').update(`${scope}:${identity}:${bucket}`).digest('hex');
    let attempt;
    const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) } };
    try {
        attempt = await AuthAttempt.findOneAndUpdate({ _id: key }, update, { upsert: true, new: true });
    } catch (error) {
        if (error.code !== 11000) throw error;
        attempt = await AuthAttempt.findOneAndUpdate({ _id: key }, { $inc: { count: 1 } }, { new: true });
    }
    return Boolean(attempt && attempt.count <= limit);
}

module.exports = { jwtSecret, issueToken, verifyToken, publicAdmin, registrationAllowed, consumeAttempt };
