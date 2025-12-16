const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../../Checkout_System/models/Order');
const Product = require('../../Product/models/Product');
const ratingService = require('../services/ratingService');

/**
 * Submit review
 * POST /api/reviews/:productId
 */
async function submitReview(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.userId; // From middleware

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    // Validate rating
    if (!rating || typeof rating !== 'number') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Rating is required and must be a number',
      });
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5',
      });
    }

    // Validate comment (optional, but if provided, should be string)
    if (comment !== undefined && (typeof comment !== 'string' || comment.trim().length === 0)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Comment must be a non-empty string if provided',
      });
    }

    // Fetch product to get vendorId
    const product = await Product.findById(productId).session(session);

    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const vendorId = product.vendorId;

    // Check if user has a DELIVERED order containing the productId
    const deliveredOrder = await Order.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      orderStatus: 'DELIVERED',
      'items.productId': new mongoose.Types.ObjectId(productId),
    }).session(session);

    if (!deliveredOrder) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'You can review only delivered products. Please ensure you have a delivered order containing this product.',
      });
    }

    // Check for existing review by same user for same product
    const existingReview = await Review.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      productId: new mongoose.Types.ObjectId(productId),
    }).session(session);

    if (existingReview) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }

    // Create new review document
    const review = new Review({
      userId: new mongoose.Types.ObjectId(userId),
      productId: new mongoose.Types.ObjectId(productId),
      vendorId: vendorId,
      rating: Math.round(rating), // Ensure integer
      comment: comment ? comment.trim() : undefined,
    });

    await review.save({ session });

    // Recalculate product rating
    await ratingService.recalculateProductRating(productId);

    // Recalculate vendor rating
    await ratingService.recalculateVendorRating(vendorId.toString());

    await session.commitTransaction();

    return res.json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        reviewId: review._id,
        productId: review.productId,
        rating: review.rating,
      },
    });
  } catch (error) {
    await session.abortTransaction();

    // Handle duplicate key error (unique index violation)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }

    console.error('Error in submitReview:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit review',
    });
  } finally {
    session.endSession();
  }
}

module.exports = {
  submitReview,
};

