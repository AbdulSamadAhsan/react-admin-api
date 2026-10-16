const mongoose = require("mongoose");
let pending;
async function connectDb() {
    if (mongoose.connection.readyState === 1) return mongoose;
    if (!pending) {
        if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
        pending = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
            .catch((error) => { pending = undefined; throw error; });
    }
    return pending;
}
module.exports = connectDb;
