const { Schema, model } = require('mongoose');
const { generateSlug } = require('../utils/slugGenerator');

const BrandSchema = new Schema(
  {
    brandName: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    brand_logo: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Auto-generate slug from brandName before saving
BrandSchema.pre('save', async function () {
  if (this.isModified('brandName')) {
    // Generate slug if not set, or if brandName changed (for new documents)
    if (!this.slug || this.isNew) {
      this.slug = generateSlug(this.brandName);
    }
  }
});

// Index for faster queries
BrandSchema.index({ isActive: 1 });
BrandSchema.index({ categoryId: 1 });
BrandSchema.index({ brandName: 1, categoryId: 1 }); // Non-unique index for querying
// Partial unique index: slug must be unique only for active brands
BrandSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = model('Brand', BrandSchema);

