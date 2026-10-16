const {Product} = require("../models/ProductModel")
const crypto = require('crypto');
const imageStorage = require('../services/ProductImageStorage');
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
const createProduct = async (req, res) => {
    try {
        const data = req.body || {};
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Image is required' });
        }
        const name = typeof data.name === 'string' ? data.name.trim() : '';
        const slug = data.slug || (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product') + '-' + crypto.randomBytes(6).toString('hex');
        const imageUrl = await imageStorage.storeUpload(req);
        const fields = ['description', 'price', 'oldPrice', 'discount', 'category', 'brand', 'style', 'color', 'stock', 'rating', 'featured', 'sales', 'active'];
        const values = Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
        for (const key of ['images', 'colors', 'sizes']) {
            if (data[key] !== undefined) values[key] = typeof data[key] === 'string' && data[key].trim().startsWith('[') ? JSON.parse(data[key]) : data[key];
        }
        const product = await Product.create({ ...values, name, slug, image: imageUrl });
        return res.status(201).json({ success: true, data: product, product, imageUrl, message: 'Product Created Successfully' });
    } catch (error) {
        await imageStorage.discardUpload(req.file);
        const invalid = error.name === 'ValidationError' || error instanceof SyntaxError;
        const duplicate = error.code === 11000;
        return res.status(duplicate ? 409 : invalid ? 400 : 500).json({
            success: false,
            message: duplicate ? 'Product slug already exists' : invalid ? 'Invalid product fields: provide name, a non-negative price, and valid array values' : 'Failed to save product'
        });
    }
};
const updateProduct=async(req,res)=>{
    let saved = false;
    const discardUpload = () => imageStorage.discardUpload(req.file);
    try {
        const { id } = req.params;
        if (!/^[a-fA-F0-9]{24}$/.test(id)) {
            await discardUpload();
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }
        const product = await Product.findById(id);
        if (!product) {
            await discardUpload();
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const data = req.body || {};
        const fields = ['name', 'slug', 'description', 'price', 'oldPrice', 'discount', 'category', 'brand', 'style', 'color', 'stock', 'rating', 'featured', 'sales', 'active'];
        for (const key of fields) {
            if (data[key] !== undefined) product[key] = data[key];
        }
        for (const key of ['images', 'colors', 'sizes']) {
            if (data[key] !== undefined) product[key] = typeof data[key] === 'string' && data[key].trim().startsWith('[') ? JSON.parse(data[key]) : data[key];
        }
        const oldImage = product.image;
        if (req.file) product.image = await imageStorage.storeUpload(req);
        await product.save();
        saved = true;

        const imageCleanupFailed = req.file && oldImage && oldImage !== product.image
            ? !(await imageStorage.cleanupImage(oldImage)) : false;
        return res.status(200).json({ ...(imageCleanupFailed ? { imageCleanupFailed: true } : {}), success: true, data: product, product, imageUrl: product.image, message: 'Product Updated Successfully' });
    } catch (error) {
        if (!saved) await discardUpload();
        const invalid = error.name === 'ValidationError' || error.name === 'CastError' || error instanceof SyntaxError;
        const duplicate = error.code === 11000;
        return res.status(duplicate ? 409 : invalid ? 400 : 500).json({
            success: false,
            message: duplicate ? 'Product slug already exists' : invalid ? 'Invalid product fields' : 'Failed to update product'
        });
    }
}
const deleteProduct=async(req,res)=>{
    try {
        const { id } = req.params;
        if (!/^[a-fA-F0-9]{24}$/.test(id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const imageCleanupFailed = !(await imageStorage.cleanupImage(product.image));
        return res.status(200).json({ success: true, message: 'Product Deleted Successfully', ...(imageCleanupFailed ? { imageCleanupFailed: true } : {}) });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
}
module.exports={
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct
}
