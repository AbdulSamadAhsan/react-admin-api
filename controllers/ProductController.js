const { Product } = require("../models/ProductModel");
const connectDb = require("../config/db");
const imageStorage = require("../services/ImageStorage");
const { randomUUID } = require("node:crypto");
const getProduct = async (req, res) => {
    try {
        await connectDb();
        const products = await Product.find();
        return res.status(200).json({ success: true, message: "Products fetched successfully", products });
    } catch (error) {
        console.error("Product list failed:", error.message);
        return res.status(503).json({ success: false, message: "Products are temporarily unavailable" });
    }
};
const createProduct = async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const rawPrice = req.body?.price;
    const price = Number(rawPrice);
    if (!name || name.length > 200) return res.status(400).json({ success: false, message: "Name is required and must be 200 characters or fewer" });
    if (typeof rawPrice !== "string" || !rawPrice.trim() || !Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: "Enter a valid non-negative price" });
    }
    if (!req.file) return res.status(400).json({ success: false, message: "Image is required" });
    let type;
    try {
        const { fileTypeFromBuffer } = await import("file-type");
        type = await fileTypeFromBuffer(req.file.buffer);
    } catch {
        return res.status(400).json({ success: false, message: "The image file is invalid" });
    }
    if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime)) {
        return res.status(400).json({ success: false, message: "Only JPEG, PNG, and WebP images are allowed" });
    }
    try {
        await connectDb();
        const blob = await imageStorage.upload(req.file.buffer, type);
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "product";
        const product = await Product.create({
            name, price, slug: `${slug}-${randomUUID()}`, image: blob.url
        });
        return res.status(201).json({
            success: true, message: "Product created successfully",
            imageUrl: blob.url, product, data: { name, price }
        });
    } catch (error) {
        // Do not delete the image on ambiguous database failures: a committed
        // product may already reference it. Reconcile unused uploads separately.
        console.error("Product creation failed:", error.message);
        return res.status(500).json({ success: false, message: "Could not create the product" });
    }
};
module.exports = { getProduct, createProduct };
