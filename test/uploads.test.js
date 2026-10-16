process.env.VERCEL = '1';
const { test } = require("node:test");
const assert = require("node:assert/strict");
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: async () => {} };
const { Product } = require("../models/ProductModel");
const images = require("../services/ImageStorage");
const app = require("../server");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ioAAAAASUVORK5CYII=", "base64");
test("upload API validates files and saves the permanent image URL", async () => {
    let uploads = 0;
    let saved;
    images.upload = async (buffer, type) => {
        uploads++;
        assert.equal(type.mime, "image/png");
        assert.deepEqual(buffer, png);
        return { url: "https://test.public.blob.vercel-storage.com/products/test.png" };
    };
    Product.create = async (data) => { saved = data; return { _id: "test", ...data }; };
    Product.find = async () => saved ? [saved] : [];
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function post({ name = "Test product", price = "25", file = png, field = "image" } = {}) {
        const form = new FormData();
        form.set("name", name); form.set("price", price);
        if (file) form.set(field, new Blob([file], { type: "image/png" }), "test.png");
        return fetch(base + "/api/products", { method: "POST", body: form });
    }
    try {
        assert.equal((await fetch(base)).status, 200);
        for (const input of [{ name: "" }, { price: "-1" }, { price: "" }, { file: null }, { file: Buffer.from("not an image") }, { file: Buffer.alloc(3 * 1024 * 1024 + 1) }, { field: "wrong" }]) {
            assert.equal((await post(input)).status, 400);
        }
        assert.equal(uploads, 0, "invalid requests must not upload anything");
        const response = await post();
        assert.equal(response.status, 201);
        const body = await response.json();
        assert.equal(body.imageUrl, saved.image);
        assert.equal(saved.price, 25);
        assert.match(saved.slug, /^test-product-/);
        assert.equal(uploads, 1);
        const listed = await (await fetch(base + "/api/products")).json();
        assert.equal(listed.products[0].image, body.imageUrl);
        images.upload = async () => { throw new Error("storage unavailable"); };
        const failed = await post();
        assert.equal(failed.status, 500);
        assert.equal((await failed.json()).message, "Failed to save product");
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
