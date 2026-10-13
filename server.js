const express=require("express");
const dotenv =require("dotenv");
const connectDb = require('./config/db');
const productRoutes = require('./routes/ProductRoute.js');
dotenv.config();
connectDb()
const PORT =process.env.PORT || 5000
const app=express();
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use('/api/products',productRoutes);
app.listen(4000,()=>{
    console.log("API Is running At:" + PORT);
});
