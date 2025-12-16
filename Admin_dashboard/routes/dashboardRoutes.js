const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { authenticateAdmin } = require('../../Admin_Settlement/middleware/authMiddleware');

const router = express.Router();

// Protected route - Get dashboard (Admin/Super Admin only)
router.get('/dashboard', authenticateAdmin, getDashboard);

module.exports = router;

