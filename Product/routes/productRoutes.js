const express = require('express');
const { createProduct, updateProduct, deleteProduct, getVendorProducts, getProductById } = require('../controllers/productController');
const { authenticateVendor } = require('../middleware/vendorMiddleware');
const { uploadProductFiles, uploadOptionalProductFiles } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Protected route - Get all products (Authenticated and Approved Vendors only)
router.get('/', authenticateVendor, getVendorProducts);

// Protected route - Get product by ID (Authenticated and Approved Vendors only)
router.get('/:productId', authenticateVendor, getProductById);

// Protected route - Create product (Authenticated and Approved Vendors only)
router.post('/', authenticateVendor, uploadProductFiles, createProduct);

// Protected route - Update product (Authenticated and Approved Vendors only)
router.post(
  '/:productId/update',
  authenticateVendor,
  uploadOptionalProductFiles,
  updateProduct,
);

// Protected route - Delete product (Authenticated and Approved Vendors only)
router.post(
  '/:productId/delete',
  authenticateVendor,
  deleteProduct,
);

module.exports = router;

