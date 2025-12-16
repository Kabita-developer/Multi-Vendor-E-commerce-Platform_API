/**
 * Status transition map
 * Defines allowed transitions for vendor order status updates
 * Vendors must follow the sequence: PENDING → PACKED → SHIPPED → DELIVERED
 */
const STATUS_TRANSITIONS = {
  PENDING: ['PACKED'],
  CONFIRMED: ['PACKED'], // Can go from CONFIRMED to PACKED
  PACKED: ['SHIPPED'],
  PROCESSING: ['SHIPPED'], // Can go from PROCESSING to SHIPPED
  SHIPPED: ['DELIVERED'],
};

/**
 * Check if status transition is allowed for vendor
 * @param {String} currentStatus - Current order status
 * @param {String} newStatus - New status to transition to
 * @returns {Boolean} True if transition is allowed
 */
function isAllowedTransition(currentStatus, newStatus) {
  const allowedStatuses = STATUS_TRANSITIONS[currentStatus];
  return allowedStatuses && allowedStatuses.includes(newStatus);
}

/**
 * Validate status transition for vendor
 * @param {String} currentStatus - Current order status
 * @param {String} newStatus - New status to transition to
 * @throws {Error} If transition is not allowed
 */
function validateVendorTransition(currentStatus, newStatus) {
  if (!isAllowedTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid status transition. Cannot change from ${currentStatus} to ${newStatus}. Allowed transitions: ${STATUS_TRANSITIONS[currentStatus]?.join(', ') || 'none'}`,
    );
  }
}

/**
 * Check if admin can override (admin can set any status)
 * @param {String} role - User role
 * @returns {Boolean} True if admin/super-admin (can override)
 */
function canOverrideStatus(role) {
  return role === 'admin' || role === 'super-admin';
}

/**
 * Get allowed statuses for current status
 * @param {String} currentStatus - Current order status
 * @returns {Array} Array of allowed statuses
 */
function getAllowedStatuses(currentStatus) {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

module.exports = {
  isAllowedTransition,
  validateVendorTransition,
  canOverrideStatus,
  getAllowedStatuses,
  STATUS_TRANSITIONS,
};

