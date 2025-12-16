const commissionService = require('../services/commissionService');
const VendorWallet = require('../models/VendorWallet');
const { authenticateVendor } = require('../../Product/middleware/vendorMiddleware');

/**
 * Get vendor wallet balance and transactions
 * GET /api/commission/wallet
 */
async function getVendorWallet(req, res, next) {
  try {
    const vendorId = req.vendorId; // From middleware

    const wallet = await commissionService.getVendorWallet(vendorId);

    return res.json({
      success: true,
      wallet: {
        vendorId: wallet.vendorId,
        balance: wallet.balance,
        totalTransactions: wallet.transactions.length,
      },
    });
  } catch (error) {
    console.error('Error in getVendorWallet:', error);
    return next(error);
  }
}

/**
 * Get vendor wallet transactions
 * GET /api/commission/wallet/transactions
 */
async function getVendorWalletTransactions(req, res, next) {
  try {
    const vendorId = req.vendorId; // From middleware
    const { page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const result = await commissionService.getVendorWalletTransactions(
      vendorId,
      limitNum,
      skip,
    );

    return res.json({
      success: true,
      wallet: {
        balance: result.balance,
        transactions: result.transactions,
        pagination: {
          page: result.page,
          limit: limitNum,
          total: result.total,
          pages: Math.ceil(result.total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Error in getVendorWalletTransactions:', error);
    return next(error);
  }
}

/**
 * Manually trigger commission calculation for an order (Admin/SuperAdmin only)
 * POST /api/commission/calculate
 */
async function calculateCommission(req, res, next) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const result = await commissionService.processCommissionForOrder(orderId);

    return res.json({
      success: true,
      message: result.message,
      commission: result.commission,
      ...(result.walletBalance !== undefined && { walletBalance: result.walletBalance }),
    });
  } catch (error) {
    console.error('Error in calculateCommission:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to calculate commission',
    });
  }
}

module.exports = {
  getVendorWallet,
  getVendorWalletTransactions,
  calculateCommission,
};

