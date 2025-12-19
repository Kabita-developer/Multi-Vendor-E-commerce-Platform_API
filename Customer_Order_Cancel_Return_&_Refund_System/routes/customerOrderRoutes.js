const express = require('express');
const {
  cancelOrder,
  requestReturn,
  getRefundStatus,
  requestRefund,
} = require('../controllers/customerOrderController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');

const router = express.Router();

// Customer order routes
router.post('/orders/:id/cancel', authenticateCustomer, cancelOrder);
router.post('/orders/:id/return', authenticateCustomer, requestReturn);
router.post('/orders/:id/request-refund', authenticateCustomer, requestRefund);
router.get('/orders/:id/refund-status', authenticateCustomer, getRefundStatus);

module.exports = router;

