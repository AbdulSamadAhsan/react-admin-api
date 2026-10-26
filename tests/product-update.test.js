// Storage lifecycle tests isolate auth; auth.test.js exercises the real guards.
const authPath = require.resolve('../middlewares/auth');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authenticate: (req, res, next) => next(), authorize: () => (req, res, next) => next() } };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ioAAAAASUVORK5CYII=', 'base64');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { Product } = require('../models/ProductModel');
const { uploadPath } = require('../middlewares/upload');
const routes = require('../routes/ProductRoute');

test('product update and upload lifecycle', async (t) => {
    const app = express();
    app.use(express.json());
    app.use('/api/products', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const originalFind = Product.findById;
    const files = new Set();
    let current;
    Product.findById = async () => current;
    await fs.mkdir(uploadPath, { recursive: true });
    const makeProduct = async (fail) => {
        const filename = `test-${crypto.randomBytes(12).toString('hex')}.png`;
        const oldPath = path.join(uploadPath, filename);
        files.add(oldPath);
        await fs.writeFile(oldPath, 'old image');
        current = new Product({ name: 'Original', slug: filename, price: 10, image: `${base}/uploads/${filename}` });
        current.save = async function () {
            if (this.image !== `${base}/uploads/${filename}`) files.add(path.join(uploadPath, new URL(this.image).pathname.split('/').pop()));
            await this.validate();
            if (fail) throw new Error('Database unavailable');
            return this;
        };
        return oldPath;
    };
    const update = async (fields, image = false, id = '507f1f77bcf86cd799439011') => {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.append(key, value);
        if (image) form.append('image', new Blob([png], { type: 'image/png' }), 'new.png');
        return fetch(`${base}/api/products/${id}`, { method: 'PUT', body: form });
    };
    try {
        await t.test('size prices save through multipart updates, survive other edits and remove deselected sizes', async () => {
            await makeProduct();
            const response = await update({ sizes: '["Small","Large"]', sizePrices: '[{"size":"Small","price":10},{"size":"Large","price":15}]' });
            assert.equal(response.status, 200);
            assert.deepEqual((await response.json()).product.sizePrices, [{ size: 'Small', price: 10 }, { size: 'Large', price: 15 }]);
            assert.equal((await update({ name: 'Size-priced product' })).status, 200);
            assert.equal(current.sizePrices.length, 2);
            assert.equal((await update({ sizes: '["Large"]' })).status, 200);
            assert.deepEqual(current.sizePrices.toObject(), [{ size: 'Large', price: 15 }]);
            assert.equal((await update({ sizePrices: '[{"size":"Large","price":-2}]' })).status, 400);
        });
        await t.test('optional gallery uploads append images and preserve existing gallery', async () => {
            await makeProduct();
            current.images = ['https://example.com/existing.png'];
            const form = new FormData();
            form.append('galleryImages', new Blob([png], { type: 'image/png' }), 'one.png');
            form.append('galleryImages', new Blob([png], { type: 'image/png' }), 'two.png');
            const response = await fetch(`${base}/api/products/507f1f77bcf86cd799439011`, { method: 'PUT', body: form });
            assert.equal(response.status, 200);
            assert.equal(current.images.length, 3);
            assert.equal(current.images[0], 'https://example.com/existing.png');
            for (const image of current.images.slice(1)) {
                const file = path.join(uploadPath, new URL(image).pathname.split('/').pop());
                files.add(file);
                assert.deepEqual(await fs.readFile(file), png);
            }
        });
        await t.test('replaces image and removes previous file after saving', async () => {
            const oldPath = await makeProduct();
            const response = await update({ name: 'Updated', price: '25', colors: '["red"]' }, true);
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.product.name, 'Updated');
            assert.equal(body.product.price, 25);
            assert.deepEqual(body.product.colors, ['red']);
            await assert.rejects(fs.access(oldPath), { code: 'ENOENT' });
            assert.deepEqual(await fs.readFile(path.join(uploadPath, new URL(body.imageUrl).pathname.split('/').pop())), png);
        });
        await t.test('keeps existing image when no upload is supplied', async () => {
            const oldPath = await makeProduct();
            const oldImage = current.image;
            const response = await update({ name: 'Renamed', image: 'untrusted replacement URL' });
            assert.equal(response.status, 200);
            assert.equal(current.image, oldImage);
            await fs.access(oldPath);
        });
        for (const [label, fields, fail, status] of [
            ['validation failure', { price: '-1' }, false, 400],
            ['database failure', { name: 'Updated' }, true, 500]
        ]) {
            await t.test(`${label} preserves old file and removes new upload`, async () => {
                const oldPath = await makeProduct(fail);
                const before = new Set(await fs.readdir(uploadPath));
                const response = await update(fields, true);
                assert.equal(response.status, status);
                await fs.access(oldPath);
                assert.deepEqual(new Set(await fs.readdir(uploadPath)), before);
            });
        }
        await t.test('invalid and missing IDs discard their uploads', async () => {
            current = null;
            for (const [id, status] of [['bad-id', 400], ['507f1f77bcf86cd799439011', 404]]) {
                const before = new Set(await fs.readdir(uploadPath));
                assert.equal((await update({}, true, id)).status, status);
                assert.deepEqual(new Set(await fs.readdir(uploadPath)), before);
            }
        });
        await t.test('missing old image does not fail a saved update', async () => {
            const oldPath = await makeProduct();
            await fs.unlink(oldPath);
            assert.equal((await update({}, true)).status, 200);
            await fs.access(path.join(uploadPath, new URL(current.image).pathname.split('/').pop()));
        });
    } finally {
        Product.findById = originalFind;
        await new Promise(resolve => server.close(resolve));
        for (const file of files) await fs.unlink(file).catch(() => {});
    }
});
