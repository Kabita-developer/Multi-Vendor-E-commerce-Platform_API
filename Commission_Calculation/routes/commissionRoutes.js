const express = require('express');
const {
  getVendorWallet,
  getVendorWalletTransactions,
} = require('../controllers/commissionController');
const { authenticateVendor } = require('../../Product/middleware/vendorMiddleware');

const router = express.Router();

// Protected routes - Vendor can view their own wallet
router.get('/wallet', authenticateVendor, getVendorWallet);
router.get('/wallet/transactions', authenticateVendor, getVendorWalletTransactions);

module.exports = router;

