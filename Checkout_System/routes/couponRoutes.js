const express = require('express');
const { authenticateAdmin } = require('../../Admin_Settlement/middleware/authMiddleware');
const { requireRole } = require('../../Category_And_Brand/middleware/roleMiddleware');
const { createCoupon, generateCode } = require('../controllers/couponController');

const router = express.Router();

// Super-Admin only coupon management
router.post('/generate-code', authenticateAdmin, requireRole(['super-admin']), generateCode);
router.post('/', authenticateAdmin, requireRole(['super-admin']), createCoupon);

module.exports = router;


