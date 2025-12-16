const express = require('express');
const { getCategories, getCategoryById, createCategory, createSubCategory, createNestedSubCategory, updateSubCategory, deleteSubCategory, updateCategory, deleteCategory, getSubCategories } = require('../controllers/categoryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();

// Public route - Get all active categories
router.get('/', getCategories);

// Public route - Get category by ID
router.get('/:id', getCategoryById);

// Protected route - Create category (Admin/Super Admin only)
router.post(
  '/create',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  createCategory,
);

// Protected route - Update category (Admin/Super Admin only)
router.post(
  '/:id/update',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  updateCategory,
);

// Protected route - Delete category (Admin/Super Admin only)
router.post(
  '/:id/delete',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  deleteCategory,
);

// Public route - Get sub-categories of a category
router.get('/:parentId/subcategories', getSubCategories);

// Protected route - Create nested sub-category under a sub-category (Admin/Super Admin only)
// This route must come before the general sub-category route to ensure proper matching
router.post(
  '/:parentId/subcategories/:subCategoryId/subcategories',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  createNestedSubCategory,
);

// Protected route - Create sub-category (Admin/Super Admin only)
router.post(
  '/:parentId/subcategories',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  createSubCategory,
);

// Protected route - Update sub-category (Admin/Super Admin only)
router.post(
  '/:parentId/subcategories/:subCategoryId/update',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  updateSubCategory,
);

// Protected route - Delete sub-category (Admin/Super Admin only)
router.post(
  '/:parentId/subcategories/:subCategoryId/delete',
  authenticateToken,
  requireRole(['admin', 'super-admin']),
  deleteSubCategory,
);

module.exports = router;

