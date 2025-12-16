const { Schema, model } = require('mongoose');
const { generateSlug } = require('../../Category_And_Brand/utils/slugGenerator');

const ProductSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price cannot be negative'],
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor ID is required'],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
    },
    subCategoryId: {
      type: String,
      trim: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    mainImage: {
      original: {
        type: String,
        required: [true, 'Main image original URL is required'],
      },
      size100: {
        type: String,
        required: [true, 'Main image 100px URL is required'],
      },
      size200: {
        type: String,
        required: [true, 'Main image 200px URL is required'],
      },
    },
    media: [
      {
        index: {
          type: Number,
          required: true,
        },
        type: {
          type: String,
          enum: ['image', 'video'],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative'],
    },
  },
  { timestamps: true },
);

// Auto-generate slug from name before saving
ProductSchema.pre('save', async function () {
  if (this.isModified('name')) {
    // Generate slug if not set, or if name changed (for new documents)
    if (!this.slug || this.isNew) {
      this.slug = generateSlug(this.name);
    }
  }
});

// Indexes for faster queries
ProductSchema.index({ vendorId: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ subCategoryId: 1 });
ProductSchema.index({ brandId: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ slug: 1 });
ProductSchema.index({ name: 1 }); // For product name search
ProductSchema.index({ price: 1 }); // For price sorting
ProductSchema.index({ createdAt: -1 }); // For newest sorting
ProductSchema.index({ vendorId: 1, isActive: 1 });
ProductSchema.index({ categoryId: 1, subCategoryId: 1 });
ProductSchema.index({ isActive: 1, name: 1 }); // Compound index for active products search
ProductSchema.index({ isActive: 1, price: 1 }); // Compound index for active products price sorting
ProductSchema.index({ isActive: 1, createdAt: -1 }); // Compound index for active products newest sorting

module.exports = model('Product', ProductSchema);

