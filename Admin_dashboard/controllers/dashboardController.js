const mongoose = require('mongoose');
const Order = require('../../Checkout_System/models/Order');
const Vendor = require('../../Vendor/models/Vendor');

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Get admin dashboard metrics
 * GET /api/admin/dashboard
 */
async function getDashboard(req, res, next) {
  try {
    // User is already authenticated via middleware (admin/super-admin)

    // Calculate total sales and platform profit using aggregation
    const overallStats = await Order.aggregate([
      {
        $match: {
          orderStatus: { $in: ['CONFIRMED', 'DELIVERED'] },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$subTotal' },
          platformProfit: {
            $sum: {
              $ifNull: ['$commission.platformAmount', 0],
            },
          },
        },
      },
    ]);

    // Extract stats or use defaults
    const totalSales = overallStats.length > 0
      ? roundToTwoDecimals(overallStats[0].totalSales || 0)
      : 0;
    const platformProfit = overallStats.length > 0
      ? roundToTwoDecimals(overallStats[0].platformProfit || 0)
      : 0;

    // Aggregate vendor performance using aggregation
    const vendorAggregation = await Order.aggregate([
      {
        $match: {
          orderStatus: { $in: ['CONFIRMED', 'DELIVERED'] },
        },
      },
      {
        $group: {
          _id: '$vendorId',
          totalSales: { $sum: '$subTotal' },
          totalOrders: { $sum: 1 },
          platformProfit: {
            $sum: {
              $ifNull: ['$commission.platformAmount', 0],
            },
          },
        },
      },
      {
        $sort: { totalSales: -1 }, // Sort by totalSales descending
      },
    ]);

    // Get vendor details (shopName) for all vendors in aggregation
    const vendorIds = vendorAggregation.map((item) => item._id);
    const vendors = await Vendor.find({
      _id: { $in: vendorIds },
    })
      .select('_id shopName')
      .lean();

    // Create vendor map for quick lookup
    const vendorMap = new Map();
    for (const vendor of vendors) {
      vendorMap.set(vendor._id.toString(), vendor.shopName);
    }

    // Build vendor performance array with shopName
    const vendorPerformance = vendorAggregation.map((item) => ({
      vendorId: item._id.toString(),
      shopName: vendorMap.get(item._id.toString()) || 'Unknown Vendor',
      totalSales: roundToTwoDecimals(item.totalSales || 0),
      totalOrders: item.totalOrders || 0,
      platformProfit: roundToTwoDecimals(item.platformProfit || 0),
    }));

    return res.json({
      success: true,
      stats: {
        totalSales,
        platformProfit,
      },
      vendorPerformance,
    });
  } catch (error) {
    console.error('Error in getDashboard:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard data',
    });
  }
}

module.exports = {
  getDashboard,
};

