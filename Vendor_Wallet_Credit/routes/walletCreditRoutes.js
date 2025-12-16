const express = require('express');
const { creditWallet, markOrderDelivered } = require('../controllers/walletCreditController');
const { authenticateVendor } = require('../../Product/middleware/vendorMiddleware');

const router = express.Router();

// Protected routes - Vendor can credit wallet for their own orders
// Note: In production, you may want to add admin/super-admin access as well
router.post('/credit', authenticateVendor, creditWallet);
router.post('/deliver', authenticateVendor, markOrderDelivered);

module.exports = router;

