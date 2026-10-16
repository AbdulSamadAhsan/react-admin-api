const mongoose = require('mongoose');
let connectionPromise;
const connectDb = () => {
    if (!connectionPromise) {
        connectionPromise = (async () => {
            if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
            const database = decodeURIComponent(new URL(process.env.MONGO_URI).pathname.slice(1));
            if (/[/\\. "$*<>:|?]/.test(database)) {
                throw new Error('MONGO_URI must contain one valid database name, not multiple path segments');
            }
            await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
            console.log('Database connected');
        })().catch((error) => { connectionPromise = undefined; throw error; });
    }
    return connectionPromise;
};
module.exports = connectDb;
