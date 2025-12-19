const express = require('express');
const {
  approveCancel,
  approveReturn,
  markPickupCompleted,
  completeReturn,
  initiateRefundAdmin,
  completeRefundAdmin,
} = require('../controllers/adminOrderController');
const { authenticateAdmin } = require('../../Admin_Settlement/middleware/authMiddleware');

const router = express.Router();

// Admin order routes
router.post('/orders/:id/approve-cancel', authenticateAdmin, approveCancel);
router.post('/orders/:id/approve-return', authenticateAdmin, approveReturn);
router.post('/orders/:id/pickup-completed', authenticateAdmin, markPickupCompleted);
router.post('/orders/:id/complete-return', authenticateAdmin, completeReturn);
router.post('/refunds/:orderId/initiate', authenticateAdmin, initiateRefundAdmin);
router.post('/refunds/:orderId/complete', authenticateAdmin, completeRefundAdmin);

module.exports = router;

