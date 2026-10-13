require("dotenv").config({ path: [".env.local", ".env"], quiet: true });
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const productRoutes = require("./routes/ProductRoute");
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3000", "https://react-admin-panel-hazel.vercel.app"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => res.json({ success: true, message: "API is running" }));
app.use("/api/products", productRoutes);
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: error.code === "LIMIT_FILE_SIZE" ? "Image must be 3 MB or smaller" : "Invalid upload"
        });
    }
    console.error("Request failed:", error.message);
    return res.status(500).json({ success: false, message: "An unexpected server error occurred" });
});
if (require.main === module) app.listen(PORT, () => console.log("API is running at: " + PORT));
module.exports = app;
