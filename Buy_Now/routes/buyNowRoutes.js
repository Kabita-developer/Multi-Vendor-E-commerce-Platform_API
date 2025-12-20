const express = require('express');
const { buyNow } = require('../controllers/buyNowController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');

const router = express.Router();

// Protected route - Buy Now (Authenticated Customer only)
router.post('/buy-now', authenticateCustomer, buyNow);

module.exports = router;

