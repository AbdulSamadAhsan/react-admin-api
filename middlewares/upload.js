const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const multer = require("multer");
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
        fileSize: 3 * 1024 * 1024,
        files: 1,
        fields: 30,
        fieldSize: 16 * 1024
    }
});
module.exports = upload;
module.exports.uploadPath = uploadPath;
