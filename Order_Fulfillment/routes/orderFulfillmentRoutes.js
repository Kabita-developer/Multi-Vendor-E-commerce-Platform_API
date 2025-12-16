const express = require('express');
const { updateOrderStatus } = require('../controllers/orderFulfillmentController');
const { authenticateOrderFulfillment } = require('../middleware/authMiddleware');

const router = express.Router();

// Protected route - Update order status
// Access: Vendor (own orders), Admin/Super Admin (any order)
router.post('/:id/status', authenticateOrderFulfillment, updateOrderStatus);

module.exports = router;

