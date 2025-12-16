const express = require('express');
const { checkout } = require('../controllers/checkoutController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');

const router = express.Router();

// Protected route - Checkout (Authenticated Customer only)
router.post('/checkout', authenticateCustomer, checkout);

module.exports = router;

