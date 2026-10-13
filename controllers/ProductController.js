const {Product} = require("../models/ProductModel")
const getProduct =async(req,res)=>{
    try {
     const products = await Product.find();
     console.log(products);


    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      products: products
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message
    });
  }

}
const createProduct=async(req,res)=>{
     const data = req.body || {};
       const image = req.file;
      const {name,price}=data;
       if(!name){
            return res.status(400).json({
                success: false,
                message: "Name is required"
            });
       }
      if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Image is required"
            });
        }

       console.log(image);
     const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  return res.status(201).json({
      data:data,
    success: true,
    imageUrl:imageUrl,
    message: "Product Created Successfully"
    });
}
module.exports={
    getProduct,
    createProduct
}