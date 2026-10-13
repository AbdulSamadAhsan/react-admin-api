const express = require('express');
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
// Vercel's application directory is read-only. Uploads here are temporary.
const uploadPath = process.env.VERCEL
    ? path.join(os.tmpdir(), "react-admin-api-uploads")
    : path.join(__dirname, "../uploads");
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(uploadPath, { recursive: true }, (error) => {
            cb(error, uploadPath);
        });
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
