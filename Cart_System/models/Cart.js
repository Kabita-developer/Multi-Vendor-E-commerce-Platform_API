const { Schema, model } = require('mongoose');

// Item schema (embedded in vendor items array)
const CartItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative'],
    },
  },
  { _id: false },
);

// Vendor schema (embedded in vendors array)
const VendorCartSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    items: {
      type: [CartItemSchema],
      default: [],
    },
    vendorSubTotal: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Vendor subtotal cannot be negative'],
    },
  },
  { _id: false },
);

// Main Cart schema
const CartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true,
    },
    vendors: {
      type: [VendorCartSchema],
      default: [],
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Grand total cannot be negative'],
    },
  },
  {
    timestamps: true,
  },
);

// Note: userId already has an index from unique: true constraint

module.exports = model('Cart', CartSchema);

