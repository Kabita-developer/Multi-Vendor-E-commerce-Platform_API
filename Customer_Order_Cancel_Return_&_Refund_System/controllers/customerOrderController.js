const mongoose = require('mongoose');
const Order = require('../../Checkout_System/models/Order');
const Product = require('../../Product/models/Product');
const { reverseCommission, initiateRefund } = require('../services/refundService');

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Cancel order
 * POST /api/orders/:id/cancel
 */
async function cancelOrder(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId; // From middleware
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

    // Verify ownership
    if (order.userId.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only cancel your own orders.',
      });
    }

    // Validate order status - customer can only cancel before shipment
    const cancellableStatuses = ['PENDING', 'CONFIRMED'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.orderStatus}. Orders can only be cancelled before shipment (PENDING or CONFIRMED status).`,
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
    order.cancelReason = reason || 'Cancelled by customer';
    order.cancelledAt = new Date();
    order.cancelledBy = 'customer';
    order.cancelledByUserId = new mongoose.Types.ObjectId(userId);

    // Add status history
    order.statusHistory.push({
      status: 'CANCELLED',
      updatedBy: 'customer',
      updatedByUserId: new mongoose.Types.ObjectId(userId),
      updatedAt: new Date(),
    });

    // Handle refund for online payments
    if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID') {
      order.refundStatus = 'PENDING';
      order.refundAmount = roundToTwoDecimals(order.payableAmount);
    } else {
      // COD orders don't need refund
      order.refundStatus = 'NOT_REQUIRED';
    }

    await order.save({ session });

    // Reverse commission if it was credited
    try {
      await reverseCommission(order._id, session);
    } catch (commissionError) {
      console.error('Error reversing commission:', commissionError);
      // Don't fail the cancellation if commission reversal fails
    }

    await session.commitTransaction();

    // Initiate refund for online payments (outside transaction)
    if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID') {
      try {
        await initiateRefund(order._id, order.payableAmount, 'Order cancellation');
      } catch (refundError) {
        console.error('Error initiating refund:', refundError);
        // Log error but don't fail the cancellation
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
    console.error('Error in cancelOrder:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order',
    });
  } finally {
    session.endSession();
  }
}

/**
 * Request return
 * POST /api/orders/:id/return
 */
async function requestReturn(req, res, next) {
  try {
    const userId = req.userId; // From middleware
    const { id } = req.params;
    const { reason, returnType = 'refund' } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Return reason is required',
      });
    }

    if (!['refund', 'replacement'].includes(returnType)) {
      return res.status(400).json({
        success: false,
        message: 'Return type must be either "refund" or "replacement"',
      });
    }

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

    // Verify ownership
    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only return your own orders.',
      });
    }

    // Check if order is already cancelled
    if (order.orderStatus === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot return a cancelled order. Cancelled orders cannot be returned. If you need assistance, please contact support.',
      });
    }

    // Check if order is already returned
    if (order.orderStatus === 'RETURNED' || order.returnStatus === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'This order has already been returned and processed.',
      });
    }

    // Validate order status - must be DELIVERED
    if (order.orderStatus !== 'DELIVERED') {
      // Check if order was ever delivered (in status history)
      const wasDelivered = order.statusHistory.some((h) => h.status === 'DELIVERED');
      
      if (wasDelivered) {
        // Order was delivered but status changed (unlikely but possible)
        return res.status(400).json({
          success: false,
          message: `Order cannot be returned. Current status: ${order.orderStatus}. The order was previously delivered but its status has changed. Please contact support for assistance.`,
        });
      } else {
        // Order was never delivered
        return res.status(400).json({
          success: false,
          message: `Order cannot be returned. Current status: ${order.orderStatus}. Only DELIVERED orders can be returned. Please wait for your order to be delivered first.`,
        });
      }
    }

    // Check return window (7 days from delivery)
    const returnWindowDays = 7;
    const deliveredHistory = order.statusHistory.find((h) => h.status === 'DELIVERED');
    const deliveredDate = deliveredHistory?.updatedAt || order.updatedAt;
    const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveredDate).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceDelivery > returnWindowDays) {
      return res.status(400).json({
        success: false,
        message: `Return window has expired. Orders can only be returned within ${returnWindowDays} days of delivery. Your order was delivered ${daysSinceDelivery} days ago.`,
      });
    }

    // Check if return already requested
    if (order.returnStatus === 'REQUESTED' || order.returnStatus === 'APPROVED' || order.returnStatus === 'PICKUP_COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Return request already exists for this order. Current return status: ${order.returnStatus}.`,
      });
    }

    // Update order
    order.returnReason = reason.trim();
    order.returnType = returnType;
    order.returnStatus = 'REQUESTED';
    order.returnRequestedAt = new Date();

    await order.save();

    return res.json({
      success: true,
      message: 'Return request submitted successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        returnStatus: 'REQUESTED',
        returnType,
      },
    });
  } catch (error) {
    console.error('Error in requestReturn:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit return request',
    });
  }
}

/**
 * Get refund status
 * GET /api/orders/:id/refund-status
 */
async function getRefundStatus(req, res, next) {
  try {
    const userId = req.userId; // From middleware
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Find order
    const order = await Order.findById(id).select('orderNumber userId refundStatus refundAmount refundInitiatedAt refundCompletedAt refundReference refundFailureReason paymentMethod paymentStatus');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Verify ownership
    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view refund status for your own orders.',
      });
    }

    return res.json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        refundStatus: order.refundStatus,
        refundAmount: order.refundAmount || null,
        refundInitiatedAt: order.refundInitiatedAt || null,
        refundCompletedAt: order.refundCompletedAt || null,
        refundReference: order.refundReference || null,
        refundFailureReason: order.refundFailureReason || null,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    console.error('Error in getRefundStatus:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch refund status',
    });
  }
}

/**
 * Request refund
 * POST /api/orders/:id/request-refund
 */
async function requestRefund(req, res, next) {
  try {
    const userId = req.userId; // From middleware
    const { id } = req.params;
    const { reason } = req.body;

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

    // Verify ownership
    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only request refunds for your own orders.',
      });
    }

    // Validate order is eligible for refund
    // Eligible if:
    // 1. Order is CANCELLED and payment was made (online)
    // 2. Order is DELIVERED and can be returned
    // 3. Payment status is PAID (online payment)

    if (order.paymentMethod === 'COD') {
      // COD orders - only eligible if order was cancelled before delivery
      if (order.orderStatus !== 'CANCELLED') {
        return res.status(400).json({
          success: false,
          message: 'Refund request not applicable for COD orders unless the order was cancelled before delivery.',
        });
      }
      // COD cancelled orders don't need refund
      return res.status(400).json({
        success: false,
        message: 'COD orders do not require refund as payment was not received. If you need assistance, please contact support.',
      });
    }

    // Online payment orders
    if (order.paymentMethod === 'ONLINE') {
      // Check if payment was made
      if (order.paymentStatus !== 'PAID') {
        return res.status(400).json({
          success: false,
          message: `Refund cannot be requested. Payment status is ${order.paymentStatus}. Only paid orders are eligible for refund.`,
        });
      }

      // Check if refund already completed
      if (order.refundStatus === 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Refund has already been completed for this order.',
        });
      }

      // Check if refund already pending - return existing refund info instead of error
      if (order.refundStatus === 'PENDING') {
        return res.json({
          success: true,
          message: 'Refund request already exists and is being processed.',
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            refundStatus: 'PENDING',
            refundAmount: order.refundAmount || roundToTwoDecimals(order.payableAmount),
            refundInitiatedAt: order.refundInitiatedAt || null,
            refundReference: order.refundReference || null,
            message: 'Your refund request is already in progress. Please check the refund status for updates.',
          },
        });
      }

      // Check if refund failed - allow retry
      if (order.refundStatus === 'FAILED') {
        // Allow retry for failed refunds
        order.refundStatus = 'PENDING';
        order.refundAmount = roundToTwoDecimals(order.payableAmount);
        order.refundInitiatedAt = new Date();
        if (reason) {
          order.refundFailureReason = null; // Clear previous failure reason
        }

        await order.save();

        // Try to initiate refund
        try {
          await initiateRefund(order._id, order.payableAmount, reason || 'Refund request retry by customer');
        } catch (refundError) {
          console.error('Error initiating refund:', refundError);
          // Don't fail the request, admin can process manually
        }

        return res.json({
          success: true,
          message: 'Refund request submitted successfully (retry)',
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            refundStatus: 'PENDING',
            refundAmount: order.refundAmount,
          },
        });
      }

      // New refund request
      // Eligible if order is CANCELLED or DELIVERED
      if (order.orderStatus === 'CANCELLED') {
        // Cancelled order - refund should be automatic, but customer can request if not initiated
        if (order.refundStatus === 'NOT_REQUIRED') {
          // Set to pending and initiate
          order.refundStatus = 'PENDING';
          order.refundAmount = roundToTwoDecimals(order.payableAmount);
          order.refundInitiatedAt = new Date();

          await order.save();

          // Try to initiate refund
          try {
            await initiateRefund(order._id, order.payableAmount, reason || 'Refund request for cancelled order');
          } catch (refundError) {
            console.error('Error initiating refund:', refundError);
            // Don't fail the request, admin can process manually
          }

          return res.json({
            success: true,
            message: 'Refund request submitted successfully',
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              refundStatus: 'PENDING',
              refundAmount: order.refundAmount,
            },
          });
        }
      } else if (order.orderStatus === 'DELIVERED') {
        // Delivered order - should go through return process first
        return res.status(400).json({
          success: false,
          message: 'For delivered orders, please use the return request API first. Refunds are processed after return approval and pickup completion.',
        });
      } else {
        // Other statuses
        return res.status(400).json({
          success: false,
          message: `Refund cannot be requested for orders with status: ${order.orderStatus}. Refunds are available for cancelled or delivered orders.`,
        });
      }
    }

    // Should not reach here
    return res.status(400).json({
      success: false,
      message: 'Refund request cannot be processed for this order.',
    });
  } catch (error) {
    console.error('Error in requestRefund:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit refund request',
    });
  }
}

module.exports = {
  cancelOrder,
  requestReturn,
  getRefundStatus,
  requestRefund,
};

