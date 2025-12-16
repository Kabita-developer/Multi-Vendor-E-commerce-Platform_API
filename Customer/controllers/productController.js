const Product = require('../../Product/models/Product');
const Category = require('../../Category_And_Brand/models/Category');
const Brand = require('../../Category_And_Brand/models/Brand');

/**
 * Get all products (Public API)
 * GET /api/products
 *
 * Query Parameters:
 * - q: product name search (case-insensitive)
 * - category: category slug
 * - subCategory: subcategory slug
 * - brand: brand slug
 * - price: price range in format "min-max" (e.g. 100-500)
 * - sort: price_asc | price_desc | newest
 * - page: page number (default 1)
 * - limit: items per page (default 10)
 */
async function getProducts(req, res, next) {
  try {
    const {
      q,
      category,
      subCategory,
      brand,
      price,
      sort = 'newest',
      page = 1,
      limit = 10,
    } = req.query;

    // Initialize base filter with isActive = true
    const filter = {
      isActive: true,
    };

    // 1. Apply product name search if q is present
    if (q && typeof q === 'string' && q.trim().length > 0) {
      filter.name = { $regex: q.trim(), $options: 'i' }; // Case-insensitive regex
    }

    // 2. Resolve category slug to categoryId
    if (category && typeof category === 'string' && category.trim().length > 0) {
      const categoryDoc = await Category.findOne({
        slug: category.trim(),
        isActive: true,
      })
        .select('_id')
        .lean();

      if (!categoryDoc) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }

      filter.categoryId = categoryDoc._id;
    }

    // 3. Resolve subCategory slug to subCategoryId
    if (subCategory && typeof subCategory === 'string' && subCategory.trim().length > 0) {
      const subCategorySlug = subCategory.trim();

      // Helper function to find subcategory by slug recursively
      const findSubCategoryBySlug = (subCategories, targetSlug) => {
        if (!subCategories || subCategories.length === 0) {
          return null;
        }

        for (const subCat of subCategories) {
          // Check if current subcategory matches
          if (subCat.slug === targetSlug && subCat.isActive) {
            return subCat._id ? subCat._id.toString() : null;
          }

          // Recursively search nested subcategories
          if (subCat.subCategories && subCat.subCategories.length > 0) {
            const found = findSubCategoryBySlug(subCat.subCategories, targetSlug);
            if (found) return found;
          }
        }

        return null;
      };

      // If category filter is already applied, search within that category
      if (filter.categoryId) {
        const categoryDoc = await Category.findById(filter.categoryId)
          .select('subCategories')
          .lean();

        if (!categoryDoc) {
          return res.status(404).json({
            success: false,
            message: 'Category not found',
          });
        }

        const subCategoryId = findSubCategoryBySlug(categoryDoc.subCategories, subCategorySlug);

        if (!subCategoryId) {
          return res.status(404).json({
            success: false,
            message: 'Sub-category not found in the specified category',
          });
        }

        filter.subCategoryId = subCategoryId;
      } else {
        // Search across all categories
        const allCategories = await Category.find({ isActive: true })
          .select('subCategories')
          .lean();

        let foundSubCategoryId = null;

        for (const cat of allCategories) {
          const subCategoryId = findSubCategoryBySlug(cat.subCategories, subCategorySlug);
          if (subCategoryId) {
            foundSubCategoryId = subCategoryId;
            break;
          }
        }

        if (!foundSubCategoryId) {
          return res.status(404).json({
            success: false,
            message: 'Sub-category not found',
          });
        }

        filter.subCategoryId = foundSubCategoryId;
      }
    }

    // 4. Resolve brand slug to brandId
    if (brand && typeof brand === 'string' && brand.trim().length > 0) {
      const brandDoc = await Brand.findOne({
        slug: brand.trim(),
        isActive: true,
      })
        .select('_id')
        .lean();

      if (!brandDoc) {
        return res.status(404).json({
          success: false,
          message: 'Brand not found',
        });
      }

      filter.brandId = brandDoc._id;
    }

    // 5. Parse and apply price range filter
    if (price && typeof price === 'string' && price.trim().length > 0) {
      const priceRange = price.trim();
      const priceMatch = priceRange.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);

      if (!priceMatch) {
        return res.status(400).json({
          success: false,
          message: 'Invalid price range format. Use "min-max" (e.g., "100-500")',
        });
      }

      const minPrice = parseFloat(priceMatch[1]);
      const maxPrice = parseFloat(priceMatch[2]);

      if (minPrice < 0 || maxPrice < 0 || minPrice > maxPrice) {
        return res.status(400).json({
          success: false,
          message: 'Invalid price range. Min must be less than or equal to max, and both must be non-negative',
        });
      }

      filter.price = {
        $gte: minPrice,
        $lte: maxPrice,
      };
    }

    // 6. Build sort object
    let sortObj = {};
    switch (sort) {
      case 'price_asc':
        sortObj = { price: 1 };
        break;
      case 'price_desc':
        sortObj = { price: -1 };
        break;
      case 'newest':
      default:
        sortObj = { createdAt: -1 };
        break;
    }

    // 7. Validate and apply pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // 8. Fetch products with pagination
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('name slug price discountPrice categoryId subCategoryId brandId mainImage createdAt')
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    // 9. Format response
    const formattedProducts = products.map((product) => ({
      id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      discountPrice: product.discountPrice,
      category: product.categoryId
        ? {
            id: product.categoryId._id || product.categoryId,
            name: product.categoryId.name,
            slug: product.categoryId.slug,
          }
        : null,
      subCategoryId: product.subCategoryId,
      brand: product.brandId
        ? {
            id: product.brandId._id || product.brandId,
            name: product.brandId.name,
            slug: product.brandId.slug,
          }
        : null,
      mainImage: product.mainImage,
      createdAt: product.createdAt,
    }));

    // 10. Return paginated response
    return res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      products: formattedProducts,
    });
  } catch (error) {
    console.error('Error in getProducts:', error);
    return next(error);
  }
}

module.exports = {
  getProducts,
};

