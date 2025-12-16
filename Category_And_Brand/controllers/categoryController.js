const Category = require('../models/Category');
const mongoose = require('mongoose');
const { generateSlug } = require('../utils/slugGenerator');

/**
 * Create a new category
 * POST /api/admin/categories
 */
async function createCategory(req, res, next) {
  try {
    const { name, description } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required and must be a non-empty string',
      });
    }

    const trimmedName = name.trim();
    const slug = generateSlug(trimmedName);

    // Check for duplicate category name
    const existingCategory = await Category.findOne({
      name: trimmedName,
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists',
      });
    }

    // Create category (top-level only)
    const category = await Category.create({
      name: trimmedName,
      slug: slug,
      description: description ? description.trim() : undefined,
      isActive: true,
      subCategories: [],
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        subCategories: category.subCategories,
        createdAt: category.createdAt,
      },
    });
  } catch (error) {
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name or slug already exists',
      });
    }

    return next(error);
  }
}

/**
 * Update a category
 * POST /api/admin/categories/:id/update
 */
async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Prepare update object
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Category name must be a non-empty string',
        });
      }

      const trimmedName = name.trim();
      const newSlug = generateSlug(trimmedName);

      // Check for duplicate name (excluding current category)
      const existingCategory = await Category.findOne({
        _id: { $ne: id },
        name: trimmedName,
      });

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: 'Category with this name already exists',
        });
      }

      updates.name = trimmedName;
      updates.slug = newSlug;
    }

    if (description !== undefined) {
      updates.description = description ? description.trim() : undefined;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isActive must be a boolean value',
        });
      }
      updates.isActive = isActive;
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    return res.json({
      success: true,
      message: 'Category updated successfully',
      data: {
        id: updatedCategory._id,
        name: updatedCategory.name,
        slug: updatedCategory.slug,
        description: updatedCategory.description,
        isActive: updatedCategory.isActive,
        subCategories: updatedCategory.subCategories,
        updatedAt: updatedCategory.updatedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name or slug already exists',
      });
    }

    return next(error);
  }
}

/**
 * Soft delete a category (set isActive to false)
 * POST /api/admin/categories/:id/delete
 */
async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Soft delete: set isActive to false
    category.isActive = false;
    await category.save();

    return res.json({
      success: true,
      message: 'Category deleted successfully (soft delete)',
      data: {
        id: category._id,
        name: category.name,
        isActive: category.isActive,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Get all active categories (public API)
 * GET /api/categories
 */
async function getCategories(req, res, next) {
  try {
    // Get all active categories with their embedded sub-categories
    const categories = await Category.find({ isActive: true })
      .select('name slug description subCategories createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories,
        count: categories.length,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Get category by ID (public API)
 * GET /api/categories/:id
 */
async function getCategoryById(req, res, next) {
  try {
    const { id } = req.params;

    const category = await Category.findById(id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Only return active categories in public API
    if (!category.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    return res.json({
      success: true,
      message: 'Category retrieved successfully',
      data: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        subCategories: category.subCategories,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
      });
    }

    return next(error);
  }
}

/**
 * Create a sub-category (adds to parent's subCategories array)
 * POST /api/categories/:parentId/subcategories
 */
async function createSubCategory(req, res, next) {
  try {
    const { parentId } = req.params;
    const { name, description, parentSubCategoryId, subCategoryParentId } = req.body; 
    // Support both parentSubCategoryId and subCategoryParentId for backward compatibility
    const targetSubCategoryParentId = parentSubCategoryId || subCategoryParentId;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sub-category name is required and must be a non-empty string',
      });
    }

    // Validate parent category exists and is active
    const parentCategory = await Category.findById(parentId);
    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: 'Parent category not found',
      });
    }

    if (!parentCategory.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create sub-category under an inactive parent category',
      });
    }

    const trimmedName = name.trim();
    const slug = generateSlug(trimmedName);

    // Helper function to check for duplicate name in sub-categories array
    const checkDuplicateInArray = (subCategories, nameToCheck) => {
      for (const subCat of subCategories) {
        if (subCat.name === nameToCheck) {
          return true;
        }
        // Recursively check nested sub-categories
        if (subCat.subCategories && subCat.subCategories.length > 0) {
          if (checkDuplicateInArray(subCat.subCategories, nameToCheck)) {
            return true;
          }
        }
      }
      return false;
    };

    // If adding to a nested sub-category (sub-category of a sub-category)
    if (targetSubCategoryParentId) {
      // Find the sub-category within the parent's subCategories array
      const findSubCategory = (subCategories, targetId) => {
        for (const subCat of subCategories) {
          if (subCat._id && subCat._id.toString() === targetId) {
            return subCat;
          }
          if (subCat.subCategories && subCat.subCategories.length > 0) {
            const found = findSubCategory(subCat.subCategories, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const targetSubCategory = findSubCategory(parentCategory.subCategories, targetSubCategoryParentId);
      if (!targetSubCategory) {
        return res.status(404).json({
          success: false,
          message: 'Parent sub-category not found',
        });
      }

      // Check for duplicate
      if (targetSubCategory.subCategories && checkDuplicateInArray(targetSubCategory.subCategories, trimmedName)) {
        return res.status(409).json({
          success: false,
          message: 'Sub-category with this name already exists',
        });
      }

      // Add nested sub-category
      if (!targetSubCategory.subCategories) {
        targetSubCategory.subCategories = [];
      }
      // For nested sub-categories, subCategories is Schema.Types.Mixed, so we must
      // explicitly assign an _id to ensure it is available in responses and lookups.
      targetSubCategory.subCategories.push({
        _id: new mongoose.Types.ObjectId(),
        name: trimmedName,
        slug: slug,
        description: description ? description.trim() : undefined,
        isActive: true,
        subCategories: [],
      });

      await parentCategory.save();

      // Reload the category to get the generated _id for the new sub-category
      const savedCategory = await Category.findById(parentId);
      if (!savedCategory) {
        return res.status(500).json({
          success: false,
          message: 'Parent category not found after saving sub-category',
        });
      }

      const savedTargetSubCategory = findSubCategory(
        savedCategory.subCategories || [],
        targetSubCategoryParentId,
      );
      if (
        !savedTargetSubCategory ||
        !Array.isArray(savedTargetSubCategory.subCategories) ||
        savedTargetSubCategory.subCategories.length === 0
      ) {
        return res.status(500).json({
          success: false,
          message: 'Failed to locate newly created nested sub-category',
        });
      }

      const newSubCategory =
        savedTargetSubCategory.subCategories[
          savedTargetSubCategory.subCategories.length - 1
        ];
      if (!newSubCategory || !newSubCategory._id) {
        return res.status(500).json({
          success: false,
          message: 'Nested sub-category created but ID is missing',
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Nested sub-category created successfully',
        data: {
          id: newSubCategory._id.toString(),
          name: newSubCategory.name,
          slug: newSubCategory.slug,
          description: newSubCategory.description,
          isActive: newSubCategory.isActive,
        },
      });
    }

    // Add sub-category to parent's subCategories array (top-level sub-category)
    // Check for duplicate name
    if (checkDuplicateInArray(parentCategory.subCategories, trimmedName)) {
      return res.status(409).json({
        success: false,
        message: 'Sub-category with this name already exists under this parent',
      });
    }

    // Add new sub-category to array
    parentCategory.subCategories.push({
      _id: new mongoose.Types.ObjectId(),
      name: trimmedName,
      slug: slug,
      description: description ? description.trim() : undefined,
      isActive: true,
      subCategories: [],
    });

    // Capture before save
    const newSubCategory =
      parentCategory.subCategories[parentCategory.subCategories.length - 1];

    await parentCategory.save();

    if (!newSubCategory || !newSubCategory._id) {
      return res.status(500).json({
        success: false,
        message: 'Sub-category created but ID is missing',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Sub-category created successfully',
      data: {
        id: newSubCategory._id.toString(),
        name: newSubCategory.name,
        slug: newSubCategory.slug,
        description: newSubCategory.description,
        isActive: newSubCategory.isActive,
      },
    });
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent category ID format',
      });
    }

    return next(error);
  }
}

/**
 * Create a sub-category under an existing sub-category (nested sub-category)
 * POST /api/categories/:parentId/subcategories/:subCategoryId/subcategories
 */
async function createNestedSubCategory(req, res, next) {
  try {
    const { parentId, subCategoryId } = req.params;
    const { name, description } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sub-category name is required and must be a non-empty string',
      });
    }

    // Validate parent category exists and is active
    const parentCategory = await Category.findById(parentId);
    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: 'Parent category not found',
      });
    }

    if (!parentCategory.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create sub-category under an inactive parent category',
      });
    }

    const trimmedName = name.trim();
    const slug = generateSlug(trimmedName);

    // Helper function to find sub-category by ID recursively
    const findSubCategory = (subCategories, targetId) => {
      for (const subCat of subCategories) {
        if (subCat._id && subCat._id.toString() === targetId) {
          return subCat;
        }
        if (subCat.subCategories && subCat.subCategories.length > 0) {
          const found = findSubCategory(subCat.subCategories, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    // Helper function to check for duplicate name in sub-categories array
    const checkDuplicateInArray = (subCategories, nameToCheck) => {
      for (const subCat of subCategories) {
        if (subCat.name === nameToCheck) {
          return true;
        }
        // Recursively check nested sub-categories
        if (subCat.subCategories && subCat.subCategories.length > 0) {
          if (checkDuplicateInArray(subCat.subCategories, nameToCheck)) {
            return true;
          }
        }
      }
      return false;
    };

    // Find the target sub-category (parent sub-category)
    const targetSubCategory = findSubCategory(parentCategory.subCategories, subCategoryId);
    if (!targetSubCategory) {
      return res.status(404).json({
        success: false,
        message: 'Parent sub-category not found',
      });
    }

    if (!targetSubCategory.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create sub-category under an inactive parent sub-category',
      });
    }

    // Check for duplicate name
    if (targetSubCategory.subCategories && checkDuplicateInArray(targetSubCategory.subCategories, trimmedName)) {
      return res.status(409).json({
        success: false,
        message: 'Sub-category with this name already exists under this parent sub-category',
      });
    }

    // Initialize subCategories array if it doesn't exist
    if (!targetSubCategory.subCategories) {
      targetSubCategory.subCategories = [];
    }

    // Add nested sub-category with explicit _id
    targetSubCategory.subCategories.push({
      _id: new mongoose.Types.ObjectId(),
      name: trimmedName,
      slug: slug,
      description: description ? description.trim() : undefined,
      isActive: true,
      subCategories: [],
    });

    // Capture the newly added sub-category before save (contains the generated _id)
    const newSubCategory =
      targetSubCategory.subCategories[targetSubCategory.subCategories.length - 1];

    await parentCategory.save();

    if (!newSubCategory || !newSubCategory._id) {
      return res.status(500).json({
        success: false,
        message: 'Nested sub-category created but ID is missing',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Nested sub-category created successfully',
      data: {
        id: newSubCategory._id.toString(),
        name: newSubCategory.name,
        slug: newSubCategory.slug,
        description: newSubCategory.description,
        isActive: newSubCategory.isActive,
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category or sub-category ID format',
      });
    }

    return next(error);
  }
}

/**
 * Get sub-categories of a specific category
 * GET /api/categories/:parentId/subcategories
 */
async function getSubCategories(req, res, next) {
  try {
    const { parentId } = req.params;

    // Validate parent category exists
    const parentCategory = await Category.findById(parentId)
      .select('name slug subCategories')
      .lean();

    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: 'Parent category not found',
      });
    }

    // Filter only active sub-categories recursively
    const filterActiveSubCategories = (subCategories) => {
      if (!subCategories || subCategories.length === 0) {
        return [];
      }

      return subCategories
        .filter(subCat => subCat.isActive)
        .map(subCat => ({
          id: subCat._id,
          name: subCat.name,
          slug: subCat.slug,
          description: subCat.description,
          isActive: subCat.isActive,
          createdAt: subCat.createdAt,
          updatedAt: subCat.updatedAt,
          ...(subCat.subCategories && subCat.subCategories.length > 0 && {
            subCategories: filterActiveSubCategories(subCat.subCategories),
          }),
        }));
    };

    const activeSubCategories = filterActiveSubCategories(parentCategory.subCategories);

    // Count all sub-categories (including nested)
    const countAllSubCategories = (subCategories) => {
      if (!subCategories || subCategories.length === 0) {
        return 0;
      }
      let count = subCategories.filter(subCat => subCat.isActive).length;
      subCategories.forEach(subCat => {
        if (subCat.isActive && subCat.subCategories) {
          count += countAllSubCategories(subCat.subCategories);
        }
      });
      return count;
    };

    const totalCount = countAllSubCategories(parentCategory.subCategories);

    return res.json({
      success: true,
      message: 'Sub-categories retrieved successfully',
      data: {
        parentCategory: {
          id: parentCategory._id,
          name: parentCategory.name,
          slug: parentCategory.slug,
        },
        subCategories: activeSubCategories,
        count: activeSubCategories.length,
        totalCount: totalCount,
      },
    });
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent category ID format',
      });
    }

    return next(error);
  }
}

/**
 * Update a sub-category
 * POST /api/categories/:parentId/subcategories/:subCategoryId/update
 */
async function updateSubCategory(req, res, next) {
  try {
    const { parentId, subCategoryId } = req.params;
    const { name, description, isActive } = req.body;

    // Validate parent category exists
    const parentCategory = await Category.findById(parentId);
    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: 'Parent category not found',
      });
    }

    // Helper function to find sub-category by ID recursively
    const findSubCategory = (subCategories, targetId) => {
      for (const subCat of subCategories) {
        if (subCat._id && subCat._id.toString() === targetId) {
          return subCat;
        }
        if (subCat.subCategories && subCat.subCategories.length > 0) {
          const found = findSubCategory(subCat.subCategories, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    // Helper function to find parent of sub-category (for nested sub-categories)
    const findParentOfSubCategory = (subCategories, targetId, parent = null) => {
      for (const subCat of subCategories) {
        if (subCat._id && subCat._id.toString() === targetId) {
          return parent;
        }
        if (subCat.subCategories && subCat.subCategories.length > 0) {
          const found = findParentOfSubCategory(subCat.subCategories, targetId, subCat);
          if (found !== null) return found;
        }
      }
      return null;
    };

    // Find the sub-category
    const targetSubCategory = findSubCategory(parentCategory.subCategories, subCategoryId);
    if (!targetSubCategory) {
      return res.status(404).json({
        success: false,
        message: 'Sub-category not found',
      });
    }

    // Update name if provided
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Sub-category name must be a non-empty string',
        });
      }

      const trimmedName = name.trim();
      const newSlug = generateSlug(trimmedName);

      // Check for duplicate name (excluding current sub-category)
      const checkDuplicateInArray = (subCategories, nameToCheck, excludeId) => {
        for (const subCat of subCategories) {
          if (subCat._id && subCat._id.toString() !== excludeId && subCat.name === nameToCheck) {
            return true;
          }
          if (subCat.subCategories && subCat.subCategories.length > 0) {
            if (checkDuplicateInArray(subCat.subCategories, nameToCheck, excludeId)) {
              return true;
            }
          }
        }
        return false;
      };

      // Check if name already exists in the same parent
      const parentOfSubCategory = findParentOfSubCategory(parentCategory.subCategories, subCategoryId);
      const siblings = parentOfSubCategory 
        ? parentOfSubCategory.subCategories 
        : parentCategory.subCategories;

      if (checkDuplicateInArray(siblings, trimmedName, subCategoryId)) {
        return res.status(409).json({
          success: false,
          message: 'Sub-category with this name already exists under the same parent',
        });
      }

      targetSubCategory.name = trimmedName;
      targetSubCategory.slug = newSlug;
    }

    // Update description if provided
    if (description !== undefined) {
      targetSubCategory.description = description ? description.trim() : undefined;
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isActive must be a boolean value',
        });
      }
      targetSubCategory.isActive = isActive;
    }

    await parentCategory.save();

    // Reload to get updated data
    const savedCategory = await Category.findById(parentId);
    const updatedSubCategory = findSubCategory(savedCategory.subCategories, subCategoryId);

    return res.json({
      success: true,
      message: 'Sub-category updated successfully',
      data: {
        id: updatedSubCategory._id.toString(),
        name: updatedSubCategory.name,
        slug: updatedSubCategory.slug,
        description: updatedSubCategory.description,
        isActive: updatedSubCategory.isActive,
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category or sub-category ID format',
      });
    }

    return next(error);
  }
}

/**
 * Delete a sub-category (hard delete - remove from embedded array)
 * POST /api/categories/:parentId/subcategories/:subCategoryId/delete
 */
async function deleteSubCategory(req, res, next) {
  try {
    const { parentId, subCategoryId } = req.params;

    // Validate parent category exists
    const parentCategory = await Category.findById(parentId);
    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: 'Parent category not found',
      });
    }

    // Helper function to hard delete a sub-category by ID recursively
    let deletedSubCategory = null;
    const removeSubCategory = (subCategories, targetId) => {
      if (!subCategories || subCategories.length === 0) return false;

      for (let i = 0; i < subCategories.length; i += 1) {
        const subCat = subCategories[i];

        if (subCat._id && subCat._id.toString() === targetId) {
          // Save a copy for response before removing
          deletedSubCategory = {
            _id: subCat._id,
            name: subCat.name,
          };
          subCategories.splice(i, 1);
          return true;
        }

        if (subCat.subCategories && subCat.subCategories.length > 0) {
          const removedFromChild = removeSubCategory(subCat.subCategories, targetId);
          if (removedFromChild) return true;
        }
      }

      return false;
    };

    const removed = removeSubCategory(parentCategory.subCategories, subCategoryId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Sub-category not found',
      });
    }

    await parentCategory.save();

    return res.json({
      success: true,
      message: 'Sub-category deleted successfully',
      data: {
        id: deletedSubCategory._id.toString(),
        name: deletedSubCategory.name,
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category or sub-category ID format',
      });
    }

    return next(error);
  }
}

module.exports = {
  createCategory,
  createSubCategory,
  createNestedSubCategory,
  updateSubCategory,
  deleteSubCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  getSubCategories,
};

