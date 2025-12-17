const Product = require('../models/Product');
const Category = require('../../Category_And_Brand/models/Category');
const Brand = require('../../Category_And_Brand/models/Brand');
const { uploadToS3, detectFileType } = require('../../Category_And_Brand/utils/s3Upload');
const { resizeImage, getResizedFileName } = require('../utils/imageResize');
const { generateSlug } = require('../../Category_And_Brand/utils/slugGenerator');
const path = require('path');

// ElasticSearch sync service (optional - fails gracefully if ElasticSearch is not available)
let syncService;
try {
  syncService = require('../../Searching_Algorithms/services/syncService');
} catch (error) {
  console.warn('ElasticSearch sync service not available:', error.message);
  syncService = null;
}

/**
 * Create a new product
 * POST /api/vendor/products
 */
async function createProduct(req, res, next) {
  try {
    // Step 1 & 2: JWT token and role verification handled by authenticateVendor middleware
    // Step 3: Vendor approval status verified by authenticateVendor middleware
    // vendorId is already set in req.vendorId from middleware

    // Step 4: Validate required fields
    const { name, description, price, discountPrice, categoryId, subCategoryId, brandId, stock } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required and must be a non-empty string',
      });
    }

    const trimmedName = name.trim();
    // Generate slug from product name
    const productSlug = generateSlug(trimmedName);

    // Validate price
    if (price === undefined || price === null || price === '') {
      return res.status(400).json({
        success: false,
        message: 'Product price is required',
      });
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid number greater than or equal to 0',
      });
    }

    // Validate discountPrice if provided
    let discountPriceNum = undefined;
    if (discountPrice !== undefined && discountPrice !== null && discountPrice !== '') {
      discountPriceNum = Number(discountPrice);
      if (isNaN(discountPriceNum) || discountPriceNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount price must be a valid number greater than or equal to 0',
        });
      }
      if (discountPriceNum >= priceNum) {
        return res.status(400).json({
          success: false,
          message: 'Discount price must be less than the regular price',
        });
      }
    }

    // Validate categoryId
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
      });
    }

    // Validate stock
    if (stock === undefined || stock === null || stock === '') {
      return res.status(400).json({
        success: false,
        message: 'Stock quantity is required',
      });
    }

    const stockNum = Number(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock must be a valid number greater than or equal to 0',
      });
    }

    // Step 5: Validate categoryId & brandId (must exist and active)
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
        message: 'Cannot assign product to an inactive category',
      });
    }

    // Validate subCategoryId if provided
    if (subCategoryId) {
      // Helper function to find sub-category by ID recursively
      const findSubCategory = (subCategories, targetId) => {
        for (const subCat of subCategories) {
          if (subCat._id && subCat._id.toString() === targetId) {
            return subCat;
          }
          if (subCat.subCategories && subCat.subCategories.length > 0) {
            const found = findSubCategory(subCat.subCategories, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const targetSubCategory = findSubCategory(category.subCategories, subCategoryId);
      if (!targetSubCategory) {
        return res.status(400).json({
          success: false,
          message: 'Sub-category not found or does not belong to the provided category',
        });
      }

      if (!targetSubCategory.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign product to an inactive sub-category',
        });
      }
    }

    // Validate brandId if provided
    if (brandId) {
      const brand = await Brand.findById(brandId);
      if (!brand) {
        return res.status(404).json({
          success: false,
          message: 'Brand not found',
        });
      }

      if (!brand.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign product to an inactive brand',
        });
      }
    }

    // Step 6: Upload mainImage to S3 in three sizes (original, 100px, 200px)
    let mainImageUrls = {};
    try {
      const mainImageFile =
        req.files && req.files.mainImage && req.files.mainImage[0]
          ? req.files.mainImage[0]
          : null;

      if (!mainImageFile) {
        return res.status(400).json({
          success: false,
          message:
            'Main image file is required. Please send it as form-data field "mainImage" with a valid image file (JPG, PNG, WebP).',
        });
      }

      const originalBuffer = mainImageFile.buffer;
      const originalName = mainImageFile.originalname;

      // Upload original size
      const originalUrl = await uploadToS3(originalBuffer, originalName, 'products');
      mainImageUrls.original = originalUrl;

      // Resize and upload 100px version
      const resized100Buffer = await resizeImage(originalBuffer, 100);
      const resized100Name = getResizedFileName(originalName, 100);
      const size100Url = await uploadToS3(resized100Buffer, resized100Name, 'products');
      mainImageUrls.size100 = size100Url;

      // Resize and upload 200px version
      const resized200Buffer = await resizeImage(originalBuffer, 200);
      const resized200Name = getResizedFileName(originalName, 200);
      const size200Url = await uploadToS3(resized200Buffer, resized200Name, 'products');
      mainImageUrls.size200 = size200Url;
    } catch (uploadError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload main image to S3',
        error: uploadError.message,
      });
    }

    // Step 7: Upload media[] files in bulk
    const mediaArray = [];
    if (req.files.media && req.files.media.length > 0) {
      try {
        // Upload files in parallel for better performance
        const uploadPromises = req.files.media.map(async (file, index) => {
          const fileExtension = path.extname(file.originalname);
          const fileType = detectFileType(fileExtension);

          if (fileType === 'unknown') {
            throw new Error(`Unsupported file type: ${fileExtension}`);
          }

          const fileUrl = await uploadToS3(file.buffer, file.originalname, 'products/media');

          return {
            index,
            type: fileType,
            url: fileUrl,
          };
        });

        const uploadedMedia = await Promise.all(uploadPromises);
        mediaArray.push(...uploadedMedia);

        // Sort by index to preserve order
        mediaArray.sort((a, b) => a.index - b.index);
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload media files to S3',
          error: uploadError.message,
        });
      }
    }

    // Step 8 & 9: Create product document and save
    try {
      const product = await Product.create({
        name: trimmedName,
        slug: productSlug,
        description: description ? description.trim() : undefined,
        price: priceNum,
        discountPrice: discountPriceNum,
        vendorId: req.vendorId, // From JWT token, never from body
        categoryId,
        subCategoryId: subCategoryId || undefined,
        brandId: brandId || undefined,
        stock: stockNum,
        mainImage: {
          original: mainImageUrls.original,
          size100: mainImageUrls.size100,
          size200: mainImageUrls.size200,
        },
        media: mediaArray,
        isActive: true,
      });

      // Step 10: Sync to ElasticSearch (non-blocking)
      if (syncService && product.isActive) {
        syncService.indexProduct(product).catch((syncError) => {
          console.error('ElasticSearch sync error (non-blocking):', syncError.message);
        });
      }

      // Step 11: Return success response
      return res.status(201).json({
        success: true,
        message: 'Product added successfully',
        data: {
          productId: product._id,
        },
      });
    } catch (createError) {
      // Handle duplicate key errors or validation errors
      if (createError.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: Object.values(createError.errors).map((err) => err.message).join(', '),
        });
      }

      console.error('Product creation error:', createError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: createError.message,
      });
    }
  } catch (error) {
    console.error('Unexpected error in createProduct:', error);
    return next(error);
  }
}

/**
 * Update an existing product (text fields + optional files)
 * POST /api/vendor/products/:productId/update
 */
async function updateProduct(req, res, next) {
  try {
    const { productId } = req.params;
    const {
      name,
      description,
      price,
      discountPrice,
      categoryId,
      subCategoryId,
      brandId,
      stock,
    } = req.body;

    // Find product and ensure it belongs to the authenticated vendor
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.vendorId.toString() !== req.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to update this product',
      });
    }

    let hasChanges = false;

    // Update name + slug
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product name must be a non-empty string',
        });
      }
      const trimmedName = name.trim();
      product.name = trimmedName;
      product.slug = generateSlug(trimmedName);
      hasChanges = true;
    }

    // Update description
    if (description !== undefined) {
      product.description = description ? description.trim() : undefined;
      hasChanges = true;
    }

    // Update price
    let priceNum = product.price;
    if (price !== undefined) {
      if (price === null || price === '') {
        return res.status(400).json({
          success: false,
          message: 'Price cannot be empty',
        });
      }
      priceNum = Number(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a valid number greater than or equal to 0',
        });
      }
      product.price = priceNum;
      hasChanges = true;
    }

    // Update discountPrice
    if (discountPrice !== undefined) {
      if (discountPrice === null || discountPrice === '') {
        product.discountPrice = undefined;
      } else {
        const discountPriceNum = Number(discountPrice);
        if (isNaN(discountPriceNum) || discountPriceNum < 0) {
          return res.status(400).json({
            success: false,
            message: 'Discount price must be a valid number greater than or equal to 0',
          });
        }
        if (discountPriceNum >= priceNum) {
          return res.status(400).json({
            success: false,
            message: 'Discount price must be less than the regular price',
          });
        }
        product.discountPrice = discountPriceNum;
      }
      hasChanges = true;
    }

    // Update stock
    if (stock !== undefined) {
      if (stock === null || stock === '') {
        return res.status(400).json({
          success: false,
          message: 'Stock quantity cannot be empty',
        });
      }
      const stockNum = Number(stock);
      if (isNaN(stockNum) || stockNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Stock must be a valid number greater than or equal to 0',
        });
      }
      product.stock = stockNum;
      hasChanges = true;
    }

    // Update category / subCategory
    if (categoryId !== undefined || subCategoryId !== undefined) {
      const newCategoryId = categoryId || product.categoryId.toString();

      const category = await Category.findById(newCategoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }
      if (!category.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign product to an inactive category',
        });
      }

      product.categoryId = newCategoryId;

      if (subCategoryId !== undefined) {
        if (!subCategoryId) {
          product.subCategoryId = undefined;
        } else {
          const findSubCategory = (subCategories, targetId) => {
            for (const subCat of subCategories) {
              if (subCat._id && subCat._id.toString() === targetId) {
                return subCat;
              }
              if (subCat.subCategories && subCat.subCategories.length > 0) {
                const found = findSubCategory(subCat.subCategories, targetId);
                if (found) return found;
              }
            }
            return null;
          };

          const targetSubCategory = findSubCategory(category.subCategories, subCategoryId);
          if (!targetSubCategory) {
            return res.status(400).json({
              success: false,
              message: 'Sub-category not found or does not belong to the provided category',
            });
          }
          if (!targetSubCategory.isActive) {
            return res.status(400).json({
              success: false,
              message: 'Cannot assign product to an inactive sub-category',
            });
          }

          product.subCategoryId = subCategoryId;
        }
      }

      hasChanges = true;
    }

    // Update brand
    if (brandId !== undefined) {
      if (!brandId) {
        product.brandId = undefined;
      } else {
        const brand = await Brand.findById(brandId);
        if (!brand) {
          return res.status(404).json({
            success: false,
            message: 'Brand not found',
          });
        }
        if (!brand.isActive) {
          return res.status(400).json({
            success: false,
            message: 'Cannot assign product to an inactive brand',
          });
        }
        product.brandId = brandId;
      }
      hasChanges = true;
    }

    // Update mainImage (optional)
    if (req.files && req.files.mainImage && req.files.mainImage.length > 0) {
      try {
        const mainImageFile = req.files.mainImage[0];
        const originalBuffer = mainImageFile.buffer;
        const originalName = mainImageFile.originalname;

        const originalUrl = await uploadToS3(originalBuffer, originalName, 'products');
        const resized100Buffer = await resizeImage(originalBuffer, 100);
        const resized100Name = getResizedFileName(originalName, 100);
        const size100Url = await uploadToS3(resized100Buffer, resized100Name, 'products');
        const resized200Buffer = await resizeImage(originalBuffer, 200);
        const resized200Name = getResizedFileName(originalName, 200);
        const size200Url = await uploadToS3(resized200Buffer, resized200Name, 'products');

        product.mainImage = {
          original: originalUrl,
          size100: size100Url,
          size200: size200Url,
        };
        hasChanges = true;
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload main image to S3',
          error: uploadError.message,
        });
      }
    }

    // Append new media files if provided
    if (req.files && req.files.media && req.files.media.length > 0) {
      try {
        const startIndex = Array.isArray(product.media) ? product.media.length : 0;
        const uploadPromises = req.files.media.map(async (file, idx) => {
          const fileExtension = path.extname(file.originalname);
          const fileType = detectFileType(fileExtension);

          if (fileType === 'unknown') {
            throw new Error(`Unsupported file type: ${fileExtension}`);
          }

          const fileUrl = await uploadToS3(file.buffer, file.originalname, 'products/media');

          return {
            index: startIndex + idx,
            type: fileType,
            url: fileUrl,
          };
        });

        const uploadedMedia = await Promise.all(uploadPromises);
        product.media = [...(product.media || []), ...uploadedMedia];
        hasChanges = true;
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload media files to S3',
          error: uploadError.message,
        });
      }
    }

    if (!hasChanges) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update',
      });
    }

    await product.save();

    // Sync to ElasticSearch (non-blocking)
    if (syncService) {
      syncService.updateProductInIndex(product).catch((syncError) => {
        console.error('ElasticSearch sync error (non-blocking):', syncError.message);
      });
    }

    return res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        productId: product._id,
      },
    });
  } catch (error) {
    console.error('Unexpected error in updateProduct:', error);
    return next(error);
  }
}

/**
 * Soft delete a product (sets isActive = false)
 * POST /api/vendor/products/:productId/delete
 */
async function deleteProduct(req, res, next) {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Ensure the product belongs to the authenticated vendor
    if (product.vendorId.toString() !== req.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this product',
      });
    }

    product.isActive = false;
    await product.save();

    // Remove from ElasticSearch (non-blocking)
    if (syncService) {
      syncService.removeProductFromIndex(product._id.toString()).catch((syncError) => {
        console.error('ElasticSearch sync error (non-blocking):', syncError.message);
      });
    }

    return res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Unexpected error in deleteProduct:', error);
    return next(error);
  }
}

/**
 * Get all products for the authenticated vendor
 * GET /api/vendor/products
 */
async function getVendorProducts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      categoryId,
      subCategoryId,
      brandId,
      isActive,
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Build query filter
    const filter = {
      vendorId: req.vendorId, // Only get products belonging to this vendor
    };

    // Add optional filters
    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (subCategoryId) {
      filter.subCategoryId = subCategoryId;
    }

    if (brandId) {
      filter.brandId = brandId;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    } else {
      // Default to active products only
      filter.isActive = true;
    }

    // Fetch products with pagination
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('-media') // Exclude media array for list view (can be large)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    return res.json({
      success: true,
      message: 'Products fetched successfully',
      data: {
        items: products.map((product) => ({
          id: product._id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          discountPrice: product.discountPrice,
          categoryId: product.categoryId,
          subCategoryId: product.subCategoryId,
          brandId: product.brandId,
          stock: product.stock,
          mainImage: product.mainImage,
          isActive: product.isActive,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages,
        },
      },
    });
  } catch (error) {
    console.error('Unexpected error in getVendorProducts:', error);
    return next(error);
  }
}

/**
 * Get a single product by ID (vendor's own product only)
 * GET /api/vendor/products/:productId
 */
async function getProductById(req, res, next) {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Verify product belongs to the authenticated vendor
    if (product.vendorId.toString() !== req.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to view this product',
      });
    }

    return res.json({
      success: true,
      message: 'Product details fetched successfully',
      data: {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        discountPrice: product.discountPrice,
        categoryId: product.categoryId,
        subCategoryId: product.subCategoryId,
        brandId: product.brandId,
        stock: product.stock,
        mainImage: product.mainImage,
        media: product.media || [],
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    console.error('Unexpected error in getProductById:', error);
    return next(error);
  }
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  getProductById,
};

