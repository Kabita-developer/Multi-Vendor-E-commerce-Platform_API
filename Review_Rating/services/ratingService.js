const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../../Product/models/Product');
const Vendor = require('../../Vendor/models/Vendor');

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Recalculate product rating
 * @param {String} productId - Product ID
 * @returns {Object} Updated rating and review count
 */
async function recalculateProductRating(productId) {
  // Aggregate reviews for this product
  const ratingStats = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  let rating = 0;
  let reviewCount = 0;

  if (ratingStats.length > 0 && ratingStats[0].totalReviews > 0) {
    rating = roundToTwoDecimals(ratingStats[0].averageRating);
    reviewCount = ratingStats[0].totalReviews;
  }

  // Update product
  await Product.findByIdAndUpdate(productId, {
    $set: {
      rating,
      reviewCount,
    },
  });

  return { rating, reviewCount };
}

/**
 * Recalculate vendor rating
 * @param {String} vendorId - Vendor ID
 * @returns {Object} Updated rating and total reviews
 */
async function recalculateVendorRating(vendorId) {
  // Aggregate all reviews for vendor's products
  const ratingStats = await Review.aggregate([
    { $match: { vendorId: new mongoose.Types.ObjectId(vendorId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  let rating = 0;
  let totalReviews = 0;

  if (ratingStats.length > 0 && ratingStats[0].totalReviews > 0) {
    rating = roundToTwoDecimals(ratingStats[0].averageRating);
    totalReviews = ratingStats[0].totalReviews;
  }

  // Update vendor
  await Vendor.findByIdAndUpdate(vendorId, {
    $set: {
      rating,
      totalReviews,
    },
  });

  return { rating, totalReviews };
}

module.exports = {
  recalculateProductRating,
  recalculateVendorRating,
  roundToTwoDecimals,
};

