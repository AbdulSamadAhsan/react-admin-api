const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { Product } = require('../models/ProductModel');
const { uploadPath } = require('../middlewares/upload');
const routes = require('../routes/ProductRoute');

test('delete product API', async (t) => {
    const app = express();
    app.use('/api/products', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const id = '507f1f77bcf86cd799439011';
    const originalDelete = Product.findByIdAndDelete;
    const filename = `test-delete-${crypto.randomBytes(12).toString('hex')}.png`;
    const imagePath = path.join(uploadPath, filename);
    const remove = (productId = id) => fetch(`${base}/api/products/${productId}`, { method: 'DELETE' });
    await fs.mkdir(uploadPath, { recursive: true });
    try {
        await t.test('deletes product before removing its image', async () => {
            await fs.writeFile(imagePath, 'image');
            Product.findByIdAndDelete = async (receivedId) => {
                assert.equal(receivedId, id);
                await fs.access(imagePath);
                return { image: `${base}/uploads/${filename}` };
            };
            const response = await remove();
            assert.equal(response.status, 200);
            assert.equal((await response.json()).success, true);
            await assert.rejects(fs.access(imagePath), { code: 'ENOENT' });
        });
        await t.test('invalid ID does not call database', async () => {
            Product.findByIdAndDelete = async () => assert.fail('Unexpected database call');
            assert.equal((await remove('invalid')).status, 400);
        });
        await t.test('missing product returns 404', async () => {
            Product.findByIdAndDelete = async () => null;
            assert.equal((await remove()).status, 404);
        });
        await t.test('database failure preserves image', async () => {
            await fs.writeFile(imagePath, 'image');
            Product.findByIdAndDelete = async () => { throw new Error('Database unavailable'); };
            assert.equal((await remove()).status, 500);
            await fs.access(imagePath);
        });
        await t.test('missing image still returns success', async () => {
            await fs.unlink(imagePath);
            Product.findByIdAndDelete = async () => ({ image: `${base}/uploads/${filename}` });
            assert.equal((await remove()).status, 200);
        });
        await t.test('encoded paths cannot delete files outside uploads', async () => {
            Product.findByIdAndDelete = async () => ({ image: `${base}/uploads/..%2Fpackage.json` });
            assert.equal((await remove()).status, 200);
            await fs.access(path.join(__dirname, '../package.json'));
        });
    } finally {
        Product.findByIdAndDelete = originalDelete;
        await new Promise(resolve => server.close(resolve));
        await fs.unlink(imagePath).catch(() => {});
    }
});
