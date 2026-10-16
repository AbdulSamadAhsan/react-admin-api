const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('deployed product Blob lifecycle', async (t) => {
    const blobPath = require.resolve('@vercel/blob');
    const oldCache = require.cache[blobPath];
    const oldVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    const oldUrl = 'https://test.public.blob.vercel-storage.com/products/old.png';
    const newUrl = 'https://test.public.blob.vercel-storage.com/products/new.png';
    let events, failSave, failUpload, failDelete;
    require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
        put: async (name, bytes, options) => {
            events.push('upload');
            assert.equal(name, 'products/new.png');
            assert.equal(bytes.toString(), 'new image');
            assert.equal(options.access, 'public');
            if (failUpload) throw new Error('Upload failed');
            return { url: newUrl };
        },
        del: async url => {
            events.push(`delete:${url}`);
            if (failDelete) throw new Error('Blob unavailable');
        }
    } };
    const { Product } = require('../models/ProductModel');
    const controller = require('../controllers/ProductController');
    const originals = { findById: Product.findById, findByIdAndDelete: Product.findByIdAndDelete, create: Product.create };
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'product-blob-test-'));
    const filePath = path.join(dir, 'new.png');
    const req = () => ({ params: { id: '507f1f77bcf86cd799439011' }, body: { name: 'New', price: 10 }, file: { path: filePath, filename: 'new.png', mimetype: 'image/png' } });
    const res = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
    const reset = async () => {
        events = []; failSave = failUpload = failDelete = false;
        await fs.writeFile(filePath, 'new image');
        Product.findById = async () => ({ image: oldUrl, async save() { events.push('save'); if (failSave) throw new Error('DB failed'); } });
        Product.findByIdAndDelete = async () => { events.push('delete-product'); if (failSave) throw new Error('DB failed'); return { image: oldUrl }; };
        Product.create = async data => { events.push('create'); if (failSave) throw new Error('DB failed'); return data; };
    };
    try {
        await t.test('replacement uploads, saves, then deletes old Blob', async () => {
            await reset(); const response = res();
            await controller.updateProduct(req(), response);
            assert.equal(response.code, 200);
            assert.equal(response.body.imageUrl, newUrl);
            assert.deepEqual(events, ['upload', 'save', `delete:${oldUrl}`]);
            await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
        });
        await t.test('failed save removes new Blob and preserves old Blob', async () => {
            await reset(); failSave = true; const response = res();
            await controller.updateProduct(req(), response);
            assert.equal(response.code, 500);
            assert.deepEqual(events, ['upload', 'save', `delete:${newUrl}`]);
        });
        await t.test('failed upload leaves product and old Blob untouched', async () => {
            await reset(); failUpload = true; const response = res();
            await controller.updateProduct(req(), response);
            assert.equal(response.code, 500);
            assert.deepEqual(events, ['upload']);
            await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
        });
        await t.test('delete removes Blob only after database deletion', async () => {
            await reset(); const response = res();
            await controller.deleteProduct(req(), response);
            assert.equal(response.code, 200);
            assert.deepEqual(events, ['delete-product', `delete:${oldUrl}`]);
            await reset(); failSave = true;
            await controller.deleteProduct(req(), res());
            assert.deepEqual(events, ['delete-product']);
        });
        await t.test('Blob cleanup failure is visible without deleting saved replacement', async () => {
            await reset(); failDelete = true; const response = res();
            await controller.updateProduct(req(), response);
            assert.equal(response.code, 200);
            assert.equal(response.body.imageCleanupFailed, true);
            assert.deepEqual(events, ['upload', 'save', `delete:${oldUrl}`]);
        });
        await t.test('create stores Blob URL and cleans Blob on failed creation', async () => {
            await reset(); const response = res();
            await controller.createProduct(req(), response);
            assert.equal(response.code, 201);
            assert.equal(response.body.product.image, newUrl);
            assert.deepEqual(events, ['upload', 'create']);
            await reset(); failSave = true;
            await controller.createProduct(req(), res());
            assert.deepEqual(events, ['upload', 'create', `delete:${newUrl}`]);
        });
    } finally {
        Object.assign(Product, originals);
        if (oldVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = oldVercel;
        if (oldCache) require.cache[blobPath] = oldCache; else delete require.cache[blobPath];
        await fs.unlink(filePath).catch(() => {});
        await fs.rmdir(dir);
    }
});
