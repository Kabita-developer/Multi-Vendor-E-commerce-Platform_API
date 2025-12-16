const express = require('express');
const { processSettlement } = require('../controllers/settlementController');
const { authenticateAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Protected route - Process settlement (Admin/Super Admin only)
router.post('/settlements/:vendorId/pay', authenticateAdmin, processSettlement);

module.exports = router;

