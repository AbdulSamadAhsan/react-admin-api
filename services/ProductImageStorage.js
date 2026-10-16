const fs = require('fs/promises');
const path = require('path');
const blob = require('@vercel/blob');
const images = require('./ImageStorage');
const { uploadPath } = require('../middlewares/upload');

async function removeImage(imageUrl) {
    if (!imageUrl) return;
    const url = new URL(imageUrl, 'http://localhost');
    if (url.protocol === 'https:' && /^[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com$/i.test(url.hostname)) {
        await blob.del(imageUrl);
        return;
    }
    if (!url.pathname.startsWith('/uploads/')) return;
    const filename = decodeURIComponent(url.pathname.slice('/uploads/'.length));
    if (!filename || filename === '.' || filename === '..' || /[\\/:\x00]/.test(filename)) return;
    await fs.unlink(path.join(uploadPath, filename)).catch(error => {
        if (error.code !== 'ENOENT') throw error;
    });
}

async function cleanupImage(imageUrl) {
    try {
        await removeImage(imageUrl);
        return true;
    } catch (error) {
        console.error('Product image cleanup failed:', error.name);
        return false;
    }
}

async function discardUpload(file) {
    if (!file) return;
    if (file.blobUrl) await cleanupImage(file.blobUrl);
    await fs.unlink(file.path).catch(error => {
        if (error.code !== 'ENOENT') console.error('Temporary upload cleanup failed:', error.name);
    });
}

async function storeUpload(req) {
    const file = req.file;
    const buffer = await fs.readFile(file.path);
    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(buffer).catch(() => undefined);
    if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) {
        const error = new Error('Only JPEG, PNG, and WebP images are allowed');
        error.name = 'ValidationError';
        throw error;
    }
    if (!process.env.VERCEL) return req.protocol + '://' + req.get('host') + '/uploads/' + file.filename;
    const result = await images.upload(buffer, type);
    file.blobUrl = result.url;
    await fs.unlink(file.path).catch(error => {
        if (error.code !== 'ENOENT') console.error('Temporary upload cleanup failed:', error.name);
    });
    return result.url;
}

module.exports = { storeUpload, discardUpload, cleanupImage };
