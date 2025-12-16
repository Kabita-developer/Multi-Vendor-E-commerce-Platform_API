const express = require('express');
const { getBrands, createBrand, updateBrand, deleteBrand } = require('../controllers/brandController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { uploadBrandLogo } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public route - Get all active brands
router.get('/', getBrands);

// Protected route - Create brand (Admin/Super Admin only)
router.post(
  '/create',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  uploadBrandLogo,
  createBrand,
);

// Protected route - Update brand (Admin/Super Admin only)
router.post(
  '/:id/update',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  uploadBrandLogo,
  updateBrand,
);

// Protected route - Delete brand (Admin/Super Admin only)
router.post(
  '/:id/delete',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  deleteBrand,
);

module.exports = router;

