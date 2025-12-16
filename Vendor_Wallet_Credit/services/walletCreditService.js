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
 * Credit vendor wallet when order is delivered
 * This function is idempotent - can be called multiple times safely
 * 
 * @param {String} orderId - Order ID
 * @param {Object} session - MongoDB session (optional)
 * @returns {Object} Result object
 */
async function creditWalletOnDelivery(orderId, session = null) {
  const options = session ? { session } : {};

  // 1. Fetch order by orderId
  const order = await Order.findById(orderId).session(session || null);

  // 2. Ensure order exists
  if (!order) {
    throw new Error('Order not found');
  }

  // 3. Ensure orderStatus === "DELIVERED"
  if (order.orderStatus !== 'DELIVERED') {
    throw new Error(
      `Order is not delivered. Current status: ${order.orderStatus}. Only DELIVERED orders can be credited.`,
    );
  }

  // 4. Check if walletCredited === true
  if (order.commission?.walletCredited === true) {
    return {
      success: true,
      message: 'Vendor wallet already credited for this order',
      alreadyCredited: true,
    };
  }

  // 5. Read vendorAmount from order.commission.vendorAmount
  if (!order.commission || !order.commission.vendorAmount) {
    throw new Error(
      'Commission not calculated for this order. Commission must be calculated before wallet credit.',
    );
  }

  const vendorAmount = order.commission.vendorAmount;

  // Validate vendor amount
  if (vendorAmount <= 0) {
    throw new Error('Vendor amount must be greater than 0');
  }

  // 6. Fetch vendor wallet by vendorId
  // 7. If wallet does not exist, create it
  const wallet = await VendorWallet.getOrCreateWallet(order.vendorId);

  // Check if this order was already credited (prevent double credit)
  // This is an additional safety check beyond walletCredited flag
  const existingTransaction = wallet.transactions.find(
    (txn) =>
      txn.orderId &&
      txn.orderId.toString() === orderId.toString() &&
      txn.type === 'CREDIT',
  );

  if (existingTransaction) {
    // Already credited, just mark as credited in order
    if (!order.commission) {
      order.commission = {};
    }
    order.commission.walletCredited = true;
    await order.save(options);

    return {
      success: true,
      message: 'Vendor wallet already credited for this order',
      alreadyCredited: true,
    };
  }

  // 8. Add vendorAmount to wallet.balance
  wallet.balance = roundToTwoDecimals(wallet.balance + vendorAmount);

  // 9. Push transaction entry
  wallet.transactions.push({
    type: 'CREDIT',
    amount: roundToTwoDecimals(vendorAmount),
    orderId: new mongoose.Types.ObjectId(orderId),
    description: `Order delivered - vendor earning credited - Order #${order.orderNumber}`,
  });

  // 10. Set order.walletCredited = true
  if (!order.commission) {
    order.commission = {};
  }
  order.commission.walletCredited = true;

  // 11. Save wallet and order
  await wallet.save(options);
  await order.save(options);

  // 12. Return success response
  return {
    success: true,
    message: 'Vendor wallet credited successfully',
    orderId: order._id,
    orderNumber: order.orderNumber,
    vendorAmount: roundToTwoDecimals(vendorAmount),
    walletBalance: wallet.balance,
    alreadyCredited: false,
  };
}

/**
 * Credit wallet for multiple orders (batch processing)
 * 
 * @param {Array<String>} orderIds - Array of order IDs
 * @param {Object} session - MongoDB session (optional)
 * @returns {Array} Array of results
 */
async function creditWalletForOrders(orderIds, session = null) {
  const results = [];

  for (const orderId of orderIds) {
    try {
      const result = await creditWalletOnDelivery(orderId, session);
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

module.exports = {
  creditWalletOnDelivery,
  creditWalletForOrders,
  roundToTwoDecimals,
};

