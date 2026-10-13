const express = require('express');
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const uploadPath = path.join(__dirname, "../uploads");
fs.mkdirSync(uploadPath, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = crypto.randomBytes(8).toString("hex") + ext;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


const router = express.Router();
const {getProduct,createProduct}=require("../controllers/ProductController")
router.get("/",getProduct);
router.post("/",upload.single("image"),createProduct)
module.exports = router;
