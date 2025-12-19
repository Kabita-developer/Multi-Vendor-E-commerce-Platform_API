const mongoose = require('mongoose');
const Order = require('../../Checkout_System/models/Order');
const VendorWallet = require('../../Commission_Calculation/models/VendorWallet');

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Get vendor dashboard metrics
 * GET /api/vendor/dashboard
 */
async function getDashboard(req, res, next) {
  try {
    const vendorId = req.vendorId; // From middleware

    // Validate vendorId
    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID',
      });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    // 1. Get Orders Statistics using aggregation
    const orderStats = await Order.aggregate([
      {
        $match: {
          vendorId: vendorObjectId,
        },
      },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$subTotal' },
        },
      },
    ]);

    // Process order statistics
    const orders = {
      total: 0,
      pending: 0,
      confirmed: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      byStatus: {},
    };

    orderStats.forEach((stat) => {
      const status = stat._id || 'UNKNOWN';
      const count = stat.count || 0;
      orders.total += count;
      orders.byStatus[status] = {
        count,
        totalAmount: roundToTwoDecimals(stat.totalAmount || 0),
      };

      // Map to specific status fields
      switch (status) {
        case 'PENDING':
          orders.pending = count;
          break;
        case 'CONFIRMED':
          orders.confirmed = count;
          break;
        case 'PACKED':
          orders.packed = count;
          break;
        case 'SHIPPED':
          orders.shipped = count;
          break;
        case 'DELIVERED':
          orders.delivered = count;
          break;
        case 'CANCELLED':
          orders.cancelled = count;
          break;
      }
    });

    // 2. Calculate Earnings (from CONFIRMED and DELIVERED orders)
    const earningsStats = await Order.aggregate([
      {
        $match: {
          vendorId: vendorObjectId,
          orderStatus: { $in: ['CONFIRMED', 'DELIVERED'] },
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: {
            $sum: {
              $ifNull: ['$commission.vendorAmount', 0],
            },
          },
          totalSales: { $sum: '$subTotal' },
          totalOrders: { $sum: 1 },
          platformCommission: {
            $sum: {
              $ifNull: ['$commission.platformAmount', 0],
            },
          },
        },
      },
    ]);

    const earnings = earningsStats.length > 0
      ? {
          totalEarnings: roundToTwoDecimals(earningsStats[0].totalEarnings || 0),
          totalSales: roundToTwoDecimals(earningsStats[0].totalSales || 0),
          totalOrders: earningsStats[0].totalOrders || 0,
          platformCommission: roundToTwoDecimals(earningsStats[0].platformCommission || 0),
        }
      : {
          totalEarnings: 0,
          totalSales: 0,
          totalOrders: 0,
          platformCommission: 0,
        };

    // 3. Get Wallet Balance
    const wallet = await VendorWallet.findOne({ vendorId: vendorObjectId })
      .select('balance holdBalance transactions')
      .lean();

    const walletBalance = wallet
      ? {
          availableBalance: roundToTwoDecimals(wallet.balance || 0),
          holdBalance: roundToTwoDecimals(wallet.holdBalance || 0),
          totalBalance: roundToTwoDecimals((wallet.balance || 0) + (wallet.holdBalance || 0)),
          totalTransactions: wallet.transactions?.length || 0,
        }
      : {
          availableBalance: 0,
          holdBalance: 0,
          totalBalance: 0,
          totalTransactions: 0,
        };

    return res.json({
      success: true,
      data: {
        orders,
        earnings,
        wallet: walletBalance,
      },
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

