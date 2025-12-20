const { Schema, model } = require('mongoose');

// Wishlist item schema
const WishlistItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// Main Wishlist schema
const WishlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true,
    },
    items: {
      type: [WishlistItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster lookups
// Note: userId index is automatically created by unique: true, so we don't need to declare it again
WishlistSchema.index({ 'items.productId': 1 });

// Prevent duplicate products in wishlist
WishlistSchema.methods.addProduct = function (productId) {
  // Check if product already exists
  const existingItem = this.items.find(
    (item) => item.productId.toString() === productId.toString(),
  );

  if (existingItem) {
    return false; // Product already in wishlist
  }

  this.items.push({
    productId,
    addedAt: new Date(),
  });

  return true; // Product added successfully
};

// Remove product from wishlist
WishlistSchema.methods.removeProduct = function (productId) {
  const initialLength = this.items.length;
  this.items = this.items.filter(
    (item) => item.productId.toString() !== productId.toString(),
  );
  return this.items.length < initialLength; // Returns true if item was removed
};

module.exports = model('Wishlist', WishlistSchema);

