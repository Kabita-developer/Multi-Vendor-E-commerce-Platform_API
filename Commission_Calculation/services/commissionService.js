const mongoose = require('mongoose');
const CommissionConfig = require('../models/CommissionConfig');
const VendorWallet = require('../models/VendorWallet');
const Order = require('../../Checkout_System/models/Order');
const Vendor = require('../../Vendor/models/Vendor');

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Get commission rate for a vendor
 * Priority: vendor-specific rate > global rate
 */
async function getCommissionRate(vendorId) {
  // Get global commission rate
  const globalConfig = await CommissionConfig.getConfig();
  const globalRate = globalConfig.globalRate;

  // Get vendor-specific commission rate
  const vendor = await Vendor.findById(vendorId).select('commissionRate').lean();

  // Use vendor-specific rate if exists, otherwise use global rate
  const commissionRate = vendor?.commissionRate !== undefined && vendor.commissionRate !== null
    ? vendor.commissionRate
    : globalRate;

  return commissionRate;
}

/**
 * Calculate commission for an order
 * @param {Number} subTotal - Order subtotal
 * @param {Number} commissionRate - Commission rate (percentage)
 * @returns {Object} Commission breakdown
 */
function calculateCommission(subTotal, commissionRate) {
  // Calculate platform commission
  const platformAmount = roundToTwoDecimals((subTotal * commissionRate) / 100);

  // Calculate vendor amount (subTotal - platform commission)
  const vendorAmount = roundToTwoDecimals(subTotal - platformAmount);

  return {
    rate: commissionRate,
    platformAmount,
    vendorAmount,
  };
}

/**
 * Process commission and credit vendor wallet for an order
 * This function is idempotent - can be called multiple times safely
 */
async function processCommissionForOrder(orderId, session = null) {
  const options = session ? { session } : {};

  // Fetch order
  const order = await Order.findById(orderId).session(session || null);

  if (!order) {
    throw new Error('Order not found');
  }

  // Check if commission already calculated and wallet credited
  if (order.commission?.walletCredited) {
    return {
      success: true,
      message: 'Commission already processed for this order',
      commission: order.commission,
    };
  }

  // Only process commission for CONFIRMED orders with PAID payment status
  // OR for COD orders that are CONFIRMED
  const isEligible =
    (order.paymentStatus === 'PAID' && order.orderStatus === 'CONFIRMED') ||
    (order.paymentMethod === 'COD' && order.orderStatus === 'CONFIRMED');

  if (!isEligible) {
    throw new Error(
      `Order is not eligible for commission. Payment Status: ${order.paymentStatus}, Order Status: ${order.orderStatus}`,
    );
  }

  // Get commission rate
  const commissionRate = await getCommissionRate(order.vendorId);

  // Calculate commission
  const commission = calculateCommission(order.subTotal, commissionRate);

  // Update order with commission snapshot
  order.commission = {
    rate: commission.rate,
    platformAmount: commission.platformAmount,
    vendorAmount: commission.vendorAmount,
    calculatedAt: new Date(),
    walletCredited: false, // Will be set to true after wallet credit
  };

  await order.save(options);

  // Credit vendor wallet
  const wallet = await VendorWallet.getOrCreateWallet(order.vendorId);

  // Check if this order was already credited (prevent double credit)
  const existingTransaction = wallet.transactions.find(
    (txn) => txn.orderId && txn.orderId.toString() === orderId.toString() && txn.type === 'CREDIT',
  );

  if (existingTransaction) {
    // Already credited, just mark as credited in order
    order.commission.walletCredited = true;
    await order.save(options);

    return {
      success: true,
      message: 'Commission already credited to wallet',
      commission: order.commission,
    };
  }

  // Credit wallet
  wallet.balance = roundToTwoDecimals(wallet.balance + commission.vendorAmount);

  // Add transaction
  wallet.transactions.push({
    type: 'CREDIT',
    amount: commission.vendorAmount,
    orderId: new mongoose.Types.ObjectId(orderId),
    description: `Order earning credit - Order #${order.orderNumber}`,
  });

  await wallet.save(options);

  // Mark commission as credited in order
  order.commission.walletCredited = true;
  await order.save(options);

  return {
    success: true,
    message: 'Commission calculated and vendor wallet updated',
    commission: order.commission,
    walletBalance: wallet.balance,
  };
}

/**
 * Process commission for multiple orders
 */
async function processCommissionForOrders(orderIds, session = null) {
  const results = [];

  for (const orderId of orderIds) {
    try {
      const result = await processCommissionForOrder(orderId, session);
      results.push({
        orderId,
        success: true,
        ...result,
      });
    } catch (error) {
      results.push({
        orderId,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Get vendor wallet balance
 */
async function getVendorWallet(vendorId) {
  const wallet = await VendorWallet.getOrCreateWallet(vendorId);
  return wallet;
}

/**
 * Get vendor wallet transactions
 */
async function getVendorWalletTransactions(vendorId, limit = 50, skip = 0) {
  const wallet = await VendorWallet.findOne({ vendorId })
    .select('transactions balance')
    .lean();

  if (!wallet) {
    return {
      balance: 0,
      transactions: [],
      total: 0,
    };
  }

  // Sort transactions by createdAt (newest first) and paginate
  const sortedTransactions = wallet.transactions.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);

  return {
    balance: wallet.balance,
    transactions: paginatedTransactions,
    total: wallet.transactions.length,
    page: Math.floor(skip / limit) + 1,
    limit,
  };
}

module.exports = {
  getCommissionRate,
  calculateCommission,
  processCommissionForOrder,
  processCommissionForOrders,
  getVendorWallet,
  getVendorWalletTransactions,
  roundToTwoDecimals,
};

