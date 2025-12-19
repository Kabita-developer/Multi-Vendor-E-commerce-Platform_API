const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { authenticateVendor } = require('../../Product/middleware/vendorMiddleware');

const router = express.Router();

// Protected route - Get vendor dashboard (Vendor only)
router.get('/dashboard', authenticateVendor, getDashboard);

module.exports = router;

