const express = require("express");
const multer = require("multer");
const { getProduct, createProduct } = require("../controllers/ProductController");
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 10, fieldSize: 16 * 1024 }
});
const router = express.Router();
router.get("/", getProduct);
router.post("/", upload.single("image"), createProduct);
module.exports = router;
