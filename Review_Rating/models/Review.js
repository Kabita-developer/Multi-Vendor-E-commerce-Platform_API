const { Schema, model } = require('mongoose');

const ReviewSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index: one review per user per product
ReviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Indexes for faster queries
ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ vendorId: 1, createdAt: -1 });
ReviewSchema.index({ rating: 1 });

module.exports = model('Review', ReviewSchema);

