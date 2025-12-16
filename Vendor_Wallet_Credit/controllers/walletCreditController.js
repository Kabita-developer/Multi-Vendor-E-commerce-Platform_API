const mongoose = require('mongoose');
const walletCreditService = require('../services/walletCreditService');
const Order = require('../../Checkout_System/models/Order');

/**
 * Credit vendor wallet for delivered order
 * POST /api/wallet-credit/credit
 */
async function creditWallet(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.body;

    // Validate orderId
    if (!orderId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Fetch order to verify ownership
    const order = await Order.findById(orderId).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Verify order belongs to authenticated vendor
    const vendorId = req.vendorId; // From middleware
    if (order.vendorId.toString() !== vendorId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to credit wallet for this order',
      });
    }

    // Credit wallet
    const result = await walletCreditService.creditWalletOnDelivery(orderId, session);

    await session.commitTransaction();

    return res.json({
      success: true,
      message: result.message,
      data: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        vendorAmount: result.vendorAmount,
        walletBalance: result.walletBalance,
        alreadyCredited: result.alreadyCredited,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in creditWallet:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to credit vendor wallet',
    });
  } finally {
    session.endSession();
  }
}

/**
 * Update order status to DELIVERED and credit wallet
 * POST /api/wallet-credit/deliver
 */
async function markOrderDelivered(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.body;

    // Validate orderId
    if (!orderId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Fetch order
    const order = await Order.findById(orderId).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Verify order belongs to authenticated vendor
    const vendorId = req.vendorId; // From middleware
    if (order.vendorId.toString() !== vendorId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to credit wallet for this order',
      });
    }

    // Check if already delivered
    if (order.orderStatus === 'DELIVERED') {
      // Try to credit wallet if not already credited
      try {
        const creditResult = await walletCreditService.creditWalletOnDelivery(orderId, session);
        await session.commitTransaction();

        return res.json({
          success: true,
          message: creditResult.alreadyCredited
            ? 'Order already delivered and wallet credited'
            : 'Wallet credited for delivered order',
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderStatus: 'DELIVERED',
            walletCredited: true,
            ...(creditResult.vendorAmount && { vendorAmount: creditResult.vendorAmount }),
            ...(creditResult.walletBalance && { walletBalance: creditResult.walletBalance }),
          },
        });
      } catch (creditError) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: creditError.message,
        });
      }
    }

    // Validate order can be marked as delivered
    if (!['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.orderStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Cannot mark order as DELIVERED. Current status: ${order.orderStatus}`,
      });
    }

    // Check if commission is calculated
    if (!order.commission || !order.commission.vendorAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Commission not calculated for this order. Commission must be calculated before delivery.',
      });
    }

    // Update order status to DELIVERED
    order.orderStatus = 'DELIVERED';
    await order.save({ session });

    // Credit wallet
    const creditResult = await walletCreditService.creditWalletOnDelivery(orderId, session);

    await session.commitTransaction();

    return res.json({
      success: true,
      message: 'Order marked as delivered and vendor wallet credited successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: 'DELIVERED',
        vendorAmount: creditResult.vendorAmount,
        walletBalance: creditResult.walletBalance,
        walletCredited: true,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in markOrderDelivered:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to mark order as delivered',
    });
  } finally {
    session.endSession();
  }
}

module.exports = {
  creditWallet,
  markOrderDelivered,
};

