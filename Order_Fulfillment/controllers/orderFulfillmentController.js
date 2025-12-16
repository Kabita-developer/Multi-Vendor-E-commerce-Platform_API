const mongoose = require('mongoose');
const Order = require('../../Checkout_System/models/Order');
const statusTransitionService = require('../services/statusTransitionService');
const walletCreditService = require('../../Vendor_Wallet_Credit/services/walletCreditService');

/**
 * Update order status
 * POST /api/vendor/orders/:id/status
 */
async function updateOrderStatus(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: orderId } = req.params;
    const { status } = req.body;
    const user = req.user; // From middleware (id, role, email)

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Validate status
    const allowedStatuses = ['PACKED', 'SHIPPED', 'DELIVERED'];
    if (!status || !allowedStatuses.includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    // 1. Fetch order by orderId
    const order = await Order.findById(orderId).session(session);

    // 2. If order not found → return 404
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // 3. If role === vendor: Ensure order.vendorId === user.vendorId
    if (user.role === 'vendor') {
      if (order.vendorId.toString() !== user.id.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to update this order',
        });
      }

      // 4. Validate allowed status transition (vendor cannot skip steps)
      try {
        statusTransitionService.validateVendorTransition(order.orderStatus, status);
      } catch (transitionError) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: transitionError.message,
        });
      }
    }

    // 5. If role === admin/superadmin: Skip transition validation (override allowed)
    // No validation needed for admin/super-admin

    // Check if status is already set
    if (order.orderStatus === status) {
      await session.abortTransaction();
      return res.json({
        success: true,
        message: `Order status is already ${status}`,
        currentStatus: status,
      });
    }

    // 6. Update order.orderStatus
    const previousStatus = order.orderStatus;
    order.orderStatus = status;

    // 7. Push status change into statusHistory
    if (!order.statusHistory) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      status,
      updatedBy: user.role,
      updatedByUserId: new mongoose.Types.ObjectId(user.id),
      updatedAt: new Date(),
    });

    // 8. If status === "DELIVERED": Trigger vendor wallet credit logic
    let walletCreditResult = null;
    if (status === 'DELIVERED') {
      try {
        // Check if commission is calculated
        if (!order.commission || !order.commission.vendorAmount) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Commission not calculated for this order. Commission must be calculated before marking as delivered.',
          });
        }

        // Credit wallet (outside transaction to avoid blocking)
        // We'll save order first, then credit wallet
        await order.save({ session });
        await session.commitTransaction();

        // Credit wallet outside transaction
        try {
          walletCreditResult = await walletCreditService.creditWalletOnDelivery(orderId);
        } catch (creditError) {
          // Log error but don't fail the status update
          console.error('Error crediting wallet after delivery:', creditError);
          // Status is already updated, wallet credit can be retried
        }

        return res.json({
          success: true,
          message: 'Order status updated to DELIVERED successfully',
          currentStatus: status,
          previousStatus,
          ...(walletCreditResult && {
            walletCredit: {
              credited: !walletCreditResult.alreadyCredited,
              vendorAmount: walletCreditResult.vendorAmount,
              walletBalance: walletCreditResult.walletBalance,
            },
          }),
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      }
    }

    // 9. Save order (for non-DELIVERED statuses)
    await order.save({ session });

    // 10. Return success response
    await session.commitTransaction();

    return res.json({
      success: true,
      message: 'Order status updated successfully',
      currentStatus: status,
      previousStatus,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in updateOrderStatus:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update order status',
    });
  } finally {
    session.endSession();
  }
}

module.exports = {
  updateOrderStatus,
};

