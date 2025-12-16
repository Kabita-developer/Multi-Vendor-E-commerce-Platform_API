const { Schema, model } = require('mongoose');
const { generateSlug } = require('../utils/slugGenerator');

// Sub-category schema (embedded document)
const SubCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Sub-category name is required'],
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
    isActive: {
      type: Boolean,
      default: true,
    },
    subCategories: {
      type: [Schema.Types.Mixed], // Recursive: sub-categories can have their own sub-categories
      default: [],
    },
  },
  { _id: true, timestamps: true },
);

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    subCategories: {
      type: [SubCategorySchema],
      default: [],
    },
  },
  { timestamps: true },
);

// Auto-generate slug from name before saving
CategorySchema.pre('save', async function () {
  if (this.isModified('name')) {
    // Generate slug if not set, or if name changed (for new documents)
    if (!this.slug || this.isNew) {
      this.slug = generateSlug(this.name);
    }
  }
});

// Indexes for faster queries
CategorySchema.index({ isActive: 1 });

module.exports = model('Category', CategorySchema);

