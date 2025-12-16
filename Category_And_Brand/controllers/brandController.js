const Brand = require('../models/Brand');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const { generateSlug } = require('../utils/slugGenerator');
const { uploadToS3 } = require('../utils/s3Upload');

/**
 * Create a new brand
 * POST /api/admin/brands
 */
async function createBrand(req, res, next) {
  try {
    const { brandName, categoryId } = req.body;
    let brandLogoUrl = null;

    // Validate brandName
    if (!brandName || typeof brandName !== 'string' || brandName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Brand name is required and must be a non-empty string',
      });
    }

    // Validate categoryId
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
      });
    }

    // Handle file upload if present
    if (req.file) {
      try {
        brandLogoUrl = await uploadToS3(req.file.buffer, req.file.originalname, 'brands');
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload brand logo to S3',
          error: uploadError.message,
        });
      }
    }

    // Check if category exists and is active
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    if (!category.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign brand to an inactive category',
      });
    }

    // Generate slug first
    const trimmedBrandName = brandName.trim();
    const baseSlug = generateSlug(trimmedBrandName);

    // Function to generate a truly unique slug using random component
    const generateUniqueSlug = (base, attempt = 0) => {
      if (attempt === 0) {
        return base;
      }
      // Use ObjectId substring for guaranteed uniqueness
      const uniqueId = new mongoose.Types.ObjectId().toString().substring(18, 24);
      return `${base}-${uniqueId}`;
    };

    // Create new brand with retry logic for duplicate key errors
    let brand;
    let attempts = 0;
    const maxAttempts = 20;
    let generatedSlug = baseSlug;
    
    while (attempts < maxAttempts) {
      try {
        // Check if slug exists for active brands before creating
        const existingSlug = await Brand.findOne({ 
          slug: generatedSlug, 
          isActive: true 
        });
        
        if (existingSlug) {
          // Generate a new unique slug with random component
          attempts++;
          generatedSlug = generateUniqueSlug(baseSlug, attempts);
          continue;
        }

        brand = await Brand.create({
          brandName: trimmedBrandName,
          slug: generatedSlug,
          categoryId,
          brand_logo: brandLogoUrl,
          isActive: true,
        });
        break; // Success, exit loop
      } catch (createError) {
        // If it's a duplicate key error, try with a new slug
        if (createError.code === 11000) {
          attempts++;
          if (attempts >= maxAttempts) {
            // Last attempt - use ObjectId to ensure absolute uniqueness
            const uniqueId = new mongoose.Types.ObjectId().toString().substring(0, 8);
            generatedSlug = `${baseSlug}-${uniqueId}`;
            try {
              brand = await Brand.create({
                brandName: trimmedBrandName,
                slug: generatedSlug,
                categoryId,
                brand_logo: brandLogoUrl,
                isActive: true,
              });
              break;
            } catch (finalError) {
              // If still failing, it might be a brandName duplicate - try with ObjectId in brandName check
              // But we want to allow duplicates, so this shouldn't happen
              console.error('Final brand creation error:', finalError);
              return res.status(409).json({
                success: false,
                message: 'Unable to create brand. There may be an old unique index in the database. Please contact support to remove old indexes.',
                details: finalError.keyPattern || 'Unknown constraint violation',
              });
            }
          }
          // Generate a new unique slug with random component
          generatedSlug = generateUniqueSlug(baseSlug, attempts);
        } else {
          // If it's not a duplicate key error, throw it
          throw createError;
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: {
        id: brand._id,
        brandName: brand.brandName,
        slug: brand.slug,
        categoryId: brand.categoryId,
        brand_logo: brand.brand_logo,
        isActive: brand.isActive,
        createdAt: brand.createdAt,
      },
    });
  } catch (error) {
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      // Try to provide more specific error message
      const errorMessage = error.keyPattern 
        ? `Duplicate value for ${Object.keys(error.keyPattern).join(', ')}`
        : 'Brand with this name or slug already exists';
      
      return res.status(409).json({
        success: false,
        message: errorMessage,
      });
    }

    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
      });
    }

    // Log unexpected errors for debugging
    console.error('Brand creation error:', error);
    return next(error);
  }
}

/**
 * Update a brand
 * POST /api/admin/brands/:id/update
 */
async function updateBrand(req, res, next) {
  try {
    const { id } = req.params;
    const { brandName, categoryId, isActive } = req.body;
    let brandLogoUrl = null;

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    // Prepare update object
    const updates = {};

    // Determine the target categoryId (use new one if being updated, otherwise current)
    let targetCategoryId = brand.categoryId;

    if (categoryId !== undefined) {
      // Check if category exists and is active
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }

      if (!category.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign brand to an inactive category',
        });
      }

      targetCategoryId = categoryId;
      updates.categoryId = categoryId;
    }

    if (brandName !== undefined) {
      if (typeof brandName !== 'string' || brandName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Brand name must be a non-empty string',
        });
      }

      const trimmedBrandName = brandName.trim();
      let newSlug = generateSlug(trimmedBrandName);

      // Check if slug already exists for active brands (excluding current brand) and make it unique if needed
      let existingSlug = await Brand.findOne({
        _id: { $ne: id },
        slug: newSlug,
        isActive: true,
      });

      // If slug exists, append a number to make it unique
      if (existingSlug) {
        let counter = 1;
        let uniqueSlug = `${newSlug}-${counter}`;
        
        while (await Brand.findOne({ 
          _id: { $ne: id },
          slug: uniqueSlug, 
          isActive: true 
        })) {
          counter++;
          uniqueSlug = `${newSlug}-${counter}`;
        }
        
        newSlug = uniqueSlug;
      }

      updates.brandName = trimmedBrandName;
      updates.slug = newSlug;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isActive must be a boolean value',
        });
      }
      updates.isActive = isActive;
    }

    // Handle file upload if present
    if (req.file) {
      try {
        brandLogoUrl = await uploadToS3(req.file.buffer, req.file.originalname, 'brands');
        updates.brand_logo = brandLogoUrl;
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload brand logo to S3',
          error: uploadError.message,
        });
      }
    }

    // Update brand
    const updatedBrand = await Brand.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    return res.json({
      success: true,
      message: 'Brand updated successfully',
      data: {
        id: updatedBrand._id,
        brandName: updatedBrand.brandName,
        slug: updatedBrand.slug,
        categoryId: updatedBrand.categoryId,
        brand_logo: updatedBrand.brand_logo,
        isActive: updatedBrand.isActive,
        updatedAt: updatedBrand.updatedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Brand with this name or slug already exists',
      });
    }

    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
      });
    }

    return next(error);
  }
}

/**
 * Soft delete a brand (set isActive to false)
 * POST /api/admin/brands/:id/delete
 */
async function deleteBrand(req, res, next) {
  try {
    const { id } = req.params;

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    // Soft delete: set isActive to false
    brand.isActive = false;
    await brand.save();

    return res.json({
      success: true,
      message: 'Brand deleted successfully (soft delete)',
      data: {
        id: brand._id,
        brandName: brand.brandName,
        isActive: brand.isActive,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Get all active brands (public API)
 * GET /api/brands
 */
async function getBrands(req, res, next) {
  try {
    const brands = await Brand.find({ isActive: true })
      .select('brandName slug categoryId createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Brands retrieved successfully',
      data: {
        brands,
        count: brands.length,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createBrand,
  updateBrand,
  deleteBrand,
  getBrands,
};

