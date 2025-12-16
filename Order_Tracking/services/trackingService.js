/**
 * Status message mapping
 * Maps order statuses to user-friendly messages
 */
const STATUS_MESSAGES = {
  PENDING: 'Order placed successfully',
  CONFIRMED: 'Order confirmed',
  PACKED: 'Seller packed your order',
  PROCESSING: 'Order is being processed',
  SHIPPED: 'Order shipped',
  DELIVERED: 'Order delivered',
  CANCELLED: 'Order cancelled',
};

/**
 * Get user-friendly message for order status
 * @param {String} status - Order status
 * @returns {String} User-friendly message
 */
function getStatusMessage(status) {
  return STATUS_MESSAGES[status] || status;
}

/**
 * Format timeline entry from status history
 * @param {Object} historyEntry - Status history entry
 * @returns {Object} Formatted timeline entry
 */
function formatTimelineEntry(historyEntry) {
  return {
    status: historyEntry.status,
    message: getStatusMessage(historyEntry.status),
    date: historyEntry.updatedAt || historyEntry.createdAt,
    updatedBy: historyEntry.updatedBy, // Can be "vendor", "admin", "super-admin", or "system"
  };
}

/**
 * Build order tracking timeline
 * @param {Object} order - Order document
 * @returns {Array} Formatted timeline array
 */
function buildTrackingTimeline(order) {
  const timeline = [];

  // Add initial order creation (PENDING status)
  timeline.push({
    status: 'PENDING',
    message: getStatusMessage('PENDING'),
    date: order.createdAt,
    updatedBy: 'system',
  });

  // Add status history entries
  if (order.statusHistory && order.statusHistory.length > 0) {
    // Sort by date (oldest first)
    const sortedHistory = [...order.statusHistory].sort(
      (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
    );

    // Add each status change
    for (const entry of sortedHistory) {
      // Skip if status is same as previous (avoid duplicates)
      const lastStatus = timeline[timeline.length - 1]?.status;
      if (entry.status !== lastStatus) {
        timeline.push(formatTimelineEntry(entry));
      }
    }
  } else {
    // If no status history, add current status if different from PENDING
    if (order.orderStatus && order.orderStatus !== 'PENDING') {
      timeline.push({
        status: order.orderStatus,
        message: getStatusMessage(order.orderStatus),
        date: order.updatedAt || order.createdAt,
        updatedBy: 'system',
      });
    }
  }

  return timeline;
}

module.exports = {
  getStatusMessage,
  formatTimelineEntry,
  buildTrackingTimeline,
  STATUS_MESSAGES,
};

