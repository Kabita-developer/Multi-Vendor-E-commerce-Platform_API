const mongoose = require('mongoose');
const Order = require('../../Checkout_System/models/Order');
const trackingService = require('../services/trackingService');

/**
 * Track order
 * GET /api/orders/:id/track
 */
async function trackOrder(req, res, next) {
  try {
    const { id: orderId } = req.params;
    const userId = req.userId; // From middleware

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // 1. Fetch order by orderId
    const order = await Order.findById(orderId)
      .select('_id orderNumber userId orderStatus statusHistory createdAt updatedAt')
      .lean();

    // 2. If order not found → return 404
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // 3. Check order.userId === logged-in userId
    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to track this order',
      });
    }

    // 4. Prepare tracking response
    const currentStatus = order.orderStatus;

    // 5. Build timeline from statusHistory
    const timeline = trackingService.buildTrackingTimeline(order);

    // 6. Return tracking response
    return res.json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      currentStatus,
      currentStatusMessage: trackingService.getStatusMessage(currentStatus),
      timeline,
    });
  } catch (error) {
    console.error('Error in trackOrder:', error);
    return next(error);
  }
}

module.exports = {
  trackOrder,
};

