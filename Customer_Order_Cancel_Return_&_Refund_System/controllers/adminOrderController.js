const mongoose = require('mongoose');
const Order = require('../../Checkout_System/models/Order');
const Product = require('../../Product/models/Product');
const { reverseCommission, initiateRefund, completeRefund } = require('../services/refundService');

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Approve order cancellation (admin override)
 * POST /api/admin/orders/:id/approve-cancel
 */
async function approveCancel(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId; // From middleware (admin)
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Find order
    const order = await Order.findById(id).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if already cancelled
    if (order.orderStatus === 'CANCELLED') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled',
      });
    }

    // Rollback product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: item.quantity } },
        { session },
      );
    }

    // Update order status
    order.orderStatus = 'CANCELLED';
    order.cancelReason = reason || 'Cancelled by admin';
    order.cancelledAt = new Date();
    order.cancelledBy = 'admin';
    order.cancelledByUserId = new mongoose.Types.ObjectId(userId);

    // Add status history
    order.statusHistory.push({
      status: 'CANCELLED',
      updatedBy: 'admin',
      updatedByUserId: new mongoose.Types.ObjectId(userId),
      updatedAt: new Date(),
    });

    // Handle refund for online payments
    if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID') {
      order.refundStatus = 'PENDING';
      order.refundAmount = roundToTwoDecimals(order.payableAmount);
    } else {
      order.refundStatus = 'NOT_REQUIRED';
    }

    await order.save({ session });

    // Reverse commission if it was credited
    try {
      await reverseCommission(order._id, session);
    } catch (commissionError) {
      console.error('Error reversing commission:', commissionError);
    }

    await session.commitTransaction();

    // Initiate refund for online payments (outside transaction)
    if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID') {
      try {
        await initiateRefund(order._id, order.payableAmount, 'Order cancellation (admin)');
      } catch (refundError) {
        console.error('Error initiating refund:', refundError);
      }
    }

    return res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: 'CANCELLED',
        refundStatus: order.refundStatus,
        refundAmount: order.refundAmount || null,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in approveCancel:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order',
    });
  } finally {
    session.endSession();
  }
}

/**
 * Approve return request
 * POST /api/admin/orders/:id/approve-return
 */
async function approveReturn(req, res, next) {
  try {
    const userId = req.userId; // From middleware (admin)
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Find order
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if return was requested
    if (order.returnStatus !== 'REQUESTED') {
      return res.status(400).json({
        success: false,
        message: `Return request not found. Current return status: ${order.returnStatus || 'N/A'}`,
      });
    }

    // Update return status
    order.returnStatus = 'APPROVED';
    order.returnApprovedAt = new Date();
    order.returnApprovedBy = new mongoose.Types.ObjectId(userId);

    // Add status history
    order.statusHistory.push({
      status: 'RETURNED',
      updatedBy: 'admin',
      updatedByUserId: new mongoose.Types.ObjectId(userId),
      updatedAt: new Date(),
    });

    await order.save();

    return res.json({
      success: true,
      message: 'Return request approved successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        returnStatus: 'APPROVED',
        returnType: order.returnType,
      },
    });
  } catch (error) {
    console.error('Error in approveReturn:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve return request',
    });
  }
}

/**
 * Mark pickup as completed
 * POST /api/admin/orders/:id/pickup-completed
 */
async function markPickupCompleted(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId; // From middleware (admin)
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Find order
    const order = await Order.findById(id).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if return is approved
    if (order.returnStatus !== 'APPROVED') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Return pickup cannot be marked as completed. Current return status: ${order.returnStatus || 'N/A'}`,
      });
    }

    // Update return status
    order.returnStatus = 'PICKUP_COMPLETED';
    order.pickupCompletedAt = new Date();

    // If return type is refund, initiate refund
    if (order.returnType === 'refund') {
      if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID') {
        order.refundStatus = 'PENDING';
        order.refundAmount = roundToTwoDecimals(order.payableAmount);
      } else {
        // COD - refund will be processed manually
        order.refundStatus = 'PENDING';
        order.refundAmount = roundToTwoDecimals(order.payableAmount);
      }
    }

    await order.save({ session });

    // Reverse commission if it was credited
    try {
      await reverseCommission(order._id, session);
    } catch (commissionError) {
      console.error('Error reversing commission:', commissionError);
    }

    await session.commitTransaction();

    // Initiate refund for online payments (outside transaction)
    if (order.returnType === 'refund' && order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID') {
      try {
        await initiateRefund(order._id, order.payableAmount, 'Order return');
      } catch (refundError) {
        console.error('Error initiating refund:', refundError);
      }
    }

    return res.json({
      success: true,
      message: 'Pickup completed successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        returnStatus: 'PICKUP_COMPLETED',
        refundStatus: order.refundStatus,
        refundAmount: order.refundAmount || null,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in markPickupCompleted:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark pickup as completed',
    });
  } finally {
    session.endSession();
  }
}

/**
 * Complete return
 * POST /api/admin/orders/:id/complete-return
 */
async function completeReturn(req, res, next) {
  try {
    const userId = req.userId; // From middleware (admin)
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Find order
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if pickup is completed
    if (order.returnStatus !== 'PICKUP_COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Return cannot be completed. Current return status: ${order.returnStatus || 'N/A'}`,
      });
    }

    // Update return status
    order.returnStatus = 'COMPLETED';
    order.returnCompletedAt = new Date();
    order.orderStatus = 'RETURNED';

    await order.save();

    return res.json({
      success: true,
      message: 'Return completed successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        returnStatus: 'COMPLETED',
        orderStatus: 'RETURNED',
      },
    });
  } catch (error) {
    console.error('Error in completeReturn:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete return',
    });
  }
}

/**
 * Initiate refund
 * POST /api/admin/refunds/:orderId/initiate
 */
async function initiateRefundAdmin(req, res, next) {
  try {
    const { orderId } = req.params;
    const { amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Validate refund can be initiated
    if (order.paymentMethod !== 'ONLINE') {
      return res.status(400).json({
        success: false,
        message: 'Refund can only be initiated for online payments',
      });
    }

    if (order.paymentStatus !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: `Refund can only be initiated for paid orders. Current payment status: ${order.paymentStatus}`,
      });
    }

    // Use provided amount or order payable amount
    const refundAmount = amount ? roundToTwoDecimals(amount) : roundToTwoDecimals(order.payableAmount);

    if (refundAmount > order.payableAmount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount cannot exceed order amount',
      });
    }

    // Initiate refund
    const result = await initiateRefund(orderId, refundAmount, 'Manual refund by admin');

    return res.json({
      success: true,
      message: 'Refund initiated successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        refundStatus: 'PENDING',
        refundAmount: result.amount,
        refundReference: result.refundReference,
      },
    });
  } catch (error) {
    console.error('Error in initiateRefundAdmin:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate refund',
    });
  }
}

/**
 * Complete refund
 * POST /api/admin/refunds/:orderId/complete
 */
async function completeRefundAdmin(req, res, next) {
  try {
    const { orderId } = req.params;
    const { refundReference } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Complete refund
    await completeRefund(orderId, refundReference);

    const order = await Order.findById(orderId);

    return res.json({
      success: true,
      message: 'Refund completed successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        refundStatus: 'COMPLETED',
        refundAmount: order.refundAmount,
        refundReference: order.refundReference,
      },
    });
  } catch (error) {
    console.error('Error in completeRefundAdmin:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete refund',
    });
  }
}

module.exports = {
  approveCancel,
  approveReturn,
  markPickupCompleted,
  completeReturn,
  initiateRefundAdmin,
  completeRefundAdmin,
};

