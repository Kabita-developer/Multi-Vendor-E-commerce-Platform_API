const express = require('express');
const { requestWithdrawal } = require('../controllers/withdrawalController');
const { authenticateVendor } = require('../../Product/middleware/vendorMiddleware');

const router = express.Router();

// Protected route - Request withdrawal (Authenticated Vendor only)
router.post('/wallet/withdraw', authenticateVendor, requestWithdrawal);

module.exports = router;

