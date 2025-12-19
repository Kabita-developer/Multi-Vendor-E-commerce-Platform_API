const Payment = require('../../Payment_Processing/models/Payment');
const Order = require('../../Checkout_System/models/Order');
const VendorWallet = require('../../Commission_Calculation/models/VendorWallet');
const mongoose = require('mongoose');

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Reverse vendor commission for cancelled/returned order
 * This debits the vendor wallet if commission was already credited
 */
async function reverseCommission(orderId, session = null) {
  const options = session ? { session } : {};

  try {
    const order = await Order.findById(orderId).session(session || null);

    if (!order) {
      throw new Error('Order not found');
    }

    // Only reverse if commission was credited
    if (!order.commission?.walletCredited) {
      return {
        success: true,
        message: 'Commission was not credited, no reversal needed',
      };
    }

    // Check if commission was already reversed
    const wallet = await VendorWallet.findOne({ vendorId: order.vendorId }).session(session || null);
    if (!wallet) {
      // Wallet doesn't exist, nothing to reverse
      return {
        success: true,
        message: 'Vendor wallet not found, no reversal needed',
      };
    }

    // Check if reversal transaction already exists
    const existingReversal = wallet.transactions.find(
      (txn) =>
        txn.orderId &&
        txn.orderId.toString() === orderId.toString() &&
        txn.type === 'DEBIT' &&
        txn.description?.includes('Commission reversal'),
    );

    if (existingReversal) {
      return {
        success: true,
        message: 'Commission already reversed',
      };
    }

    // Debit vendor wallet
    const reversalAmount = order.commission.vendorAmount || 0;
    wallet.balance = roundToTwoDecimals(wallet.balance - reversalAmount);

    // Add reversal transaction
    wallet.transactions.push({
      type: 'DEBIT',
      amount: reversalAmount,
      orderId: new mongoose.Types.ObjectId(orderId),
      description: `Commission reversal - Order #${order.orderNumber} cancelled/returned`,
    });

    await wallet.save(options);

    return {
      success: true,
      message: 'Commission reversed successfully',
      reversalAmount,
      walletBalance: wallet.balance,
    };
  } catch (error) {
    console.error('Error reversing commission:', error);
    throw error;
  }
}

/**
 * Initiate refund for online payment
 * This is a placeholder - in production, integrate with actual payment gateway
 */
async function initiateRefund(orderId, amount, reason = 'Order cancellation/return') {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.paymentMethod !== 'ONLINE') {
      throw new Error('Refund can only be initiated for online payments');
    }

    if (!order.paymentIntentId) {
      throw new Error('Payment intent ID not found');
    }

    // Find payment record
    const payment = await Payment.findOne({
      gatewayOrderId: order.paymentIntentId,
      userId: order.userId,
    });

    if (!payment) {
      throw new Error('Payment record not found');
    }

    // In production, call actual payment gateway refund API
    // For Razorpay: razorpay.payments.refund(paymentId, { amount })
    // For Stripe: stripe.refunds.create({ payment_intent: paymentIntentId, amount })

    // Placeholder implementation
    const refundReference = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Update order refund status
    order.refundStatus = 'PENDING';
    order.refundAmount = roundToTwoDecimals(amount);
    order.refundInitiatedAt = new Date();
    order.refundReference = refundReference;

    await order.save();

    // In production, handle gateway response and update refund status accordingly
    // For now, we'll mark it as pending and admin can manually complete it

    return {
      success: true,
      message: 'Refund initiated successfully',
      refundReference,
      amount: roundToTwoDecimals(amount),
    };
  } catch (error) {
    console.error('Error initiating refund:', error);
    throw error;
  }
}

/**
 * Complete refund (mark as completed)
 * This is called after payment gateway confirms refund
 */
async function completeRefund(orderId, refundReference = null) {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.refundStatus !== 'PENDING') {
      throw new Error(`Refund is not in PENDING status. Current status: ${order.refundStatus}`);
    }

    order.refundStatus = 'COMPLETED';
    order.refundCompletedAt = new Date();
    if (refundReference) {
      order.refundReference = refundReference;
    }
    order.paymentStatus = 'REFUNDED';

    await order.save();

    return {
      success: true,
      message: 'Refund completed successfully',
    };
  } catch (error) {
    console.error('Error completing refund:', error);
    throw error;
  }
}

module.exports = {
  reverseCommission,
  initiateRefund,
  completeRefund,
};

