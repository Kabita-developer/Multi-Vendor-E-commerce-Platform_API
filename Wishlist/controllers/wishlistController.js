const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const Product = require('../../Product/models/Product');

/**
 * Add product to wishlist
 * POST /api/wishlist/add
 */
async function addToWishlist(req, res, next) {
  try {
    const { productId } = req.body;
    const userId = req.userId; // From middleware

    // Validate required fields
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    // Validate productId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    // Check if product exists
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        items: [],
      });
    }

    // Check if product already in wishlist
    const existingItem = wishlist.items.find(
      (item) => item.productId.toString() === productId.toString(),
    );

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Product is already in your wishlist',
      });
    }

    // Add product to wishlist
    wishlist.items.push({
      productId,
      addedAt: new Date(),
    });

    await wishlist.save();

    return res.json({
      success: true,
      message: 'Product added to wishlist successfully',
      data: {
        wishlistId: wishlist._id,
        productId: productId,
        totalItems: wishlist.items.length,
      },
    });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    return next(error);
  }
}

/**
 * Get wishlist items
 * GET /api/wishlist
 */
async function getWishlist(req, res, next) {
  try {
    const userId = req.userId; // From middleware

    // Find wishlist
    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'items.productId',
        select: 'name price discountPrice mainImage slug stock isActive vendorId categoryId brandId',
        populate: [
          {
            path: 'vendorId',
            select: 'shopName',
          },
          {
            path: 'categoryId',
            select: 'name',
          },
          {
            path: 'brandId',
            select: 'name',
          },
        ],
      })
      .lean();

    if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
      return res.json({
        success: true,
        message: 'Wishlist is empty',
        data: {
          items: [],
          totalItems: 0,
        },
      });
    }

    // Format response
    const formattedItems = wishlist.items
      .filter((item) => item.productId) // Filter out deleted products
      .map((item) => {
        const product = item.productId;

        return {
          wishlistItemId: product._id.toString(), // Use productId as identifier
          productId: product._id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          discountPrice: product.discountPrice,
          currentPrice: product.discountPrice || product.price,
          stock: product.stock,
          isActive: product.isActive,
          mainImage: product.mainImage,
          vendor: product.vendorId
            ? {
                id: product.vendorId._id,
                shopName: product.vendorId.shopName,
              }
            : null,
          category: product.categoryId
            ? {
                id: product.categoryId._id,
                name: product.categoryId.name,
              }
            : null,
          brand: product.brandId
            ? {
                id: product.brandId._id,
                name: product.brandId.name,
              }
            : null,
          addedAt: item.addedAt,
        };
      });

    return res.json({
      success: true,
      message: 'Wishlist retrieved successfully',
      data: {
        items: formattedItems,
        totalItems: formattedItems.length,
      },
    });
  } catch (error) {
    console.error('Error in getWishlist:', error);
    return next(error);
  }
}

/**
 * Remove product from wishlist
 * DELETE /api/wishlist/remove/:id
 */
async function removeFromWishlist(req, res, next) {
  try {
    const { id } = req.params; // productId
    const userId = req.userId; // From middleware

    // Validate productId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    // Find wishlist
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist is empty or not found',
      });
    }

    // Check if product exists in wishlist
    const itemIndex = wishlist.items.findIndex(
      (item) => item.productId.toString() === id.toString(),
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in wishlist',
      });
    }

    // Remove product from wishlist
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    return res.json({
      success: true,
      message: 'Product removed from wishlist successfully',
      data: {
        productId: id,
        totalItems: wishlist.items.length,
      },
    });
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    return next(error);
  }
}

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
};

