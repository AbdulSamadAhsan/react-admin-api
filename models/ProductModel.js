const mongoose = require("mongoose");
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true
    },

    slug: {
      type: String,
      required: [true, "Product slug is required"],
      unique: true,
      lowercase: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"]
    },

    oldPrice: {
      type: Number,
      default: 0,
      min: 0
    },

    discount: {
      type: String,
      default: "0%"
    },

    image: {
      type: String,
      required: [true, "Product image is required"]
    },

    images: {
      type: [String],
      default: []
    },

    category: {
      type: String,
      trim: true,
      default: ""
    },

    brand: {
      type: String,
      trim: true,
      default: ""
    },

    style: {
      type: String,
      default: ""
    },

    color: {
      type: String,
      default: ""
    },

    colors: {
      type: [String],
      default: []
    },

    sizes: {
      type: [String],
      default: []
    },
    sizePrices: {
      type: [new mongoose.Schema({ size: { type: String, required: true }, price: { type: Number, required: true, min: 0 } }, { _id: false })],
      default: []
    },

    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"]
    },

    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5
    },

    featured: {
      type: Boolean,
      default: false
    },

    sales: {
      type: Number,
      default: 0,
      min: 0
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Create Mongoose Model
const Product = mongoose.model("Product", productSchema);

// Export Model
module.exports = { Product };
