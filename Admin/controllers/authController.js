const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { generateToken } = require('../../utils/auth');
const Vendor = require('../../Vendor/models/Vendor');
const Product = require('../../Product/models/Product');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function getTokenFromHeader(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
}

async function signup(req, res, next) {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Admin already exists' });
    }

    const admin = await Admin.create({
      email,
      name,
      password,
    });

    return res.status(201).json({
      message: 'Admin created',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (password !== admin.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate a JWT for the admin (preferred for auth)
    const token = jwt.sign(
      {
        sub: admin.id,
        role: admin.role,
        email: admin.email,
      },
      JWT_SECRET,
      { expiresIn: '2h' },
    );

    return res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
}

async function approveVendor(req, res, next) {
  try {
    const { id } = req.params;
    const { approverEmail } = req.body || {};

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    vendor.status = 'approved';
    vendor.approvedBy = {
      role: 'admin',
      approverEmail: approverEmail || null,
    };
    await vendor.save();

    return res.json({
      message: 'Vendor approved by admin',
      vendor: {
        id: vendor.id,
        shopName: vendor.shopName,
        ownerName: vendor.ownerName,
        email: vendor.email,
        phone: vendor.phone,
        status: vendor.status,
        approvedBy: vendor.approvedBy,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function rejectVendor(req, res, next) {
  try {
    const { id } = req.params;
    const { approverEmail, reason } = req.body || {};

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    vendor.status = 'rejected';
    vendor.approvedBy = {
      role: 'admin',
      approverEmail: approverEmail || null,
      reason: reason || null,
    };
    await vendor.save();

    return res.json({
      message: 'Vendor rejected by admin',
      vendor: {
        id: vendor.id,
        shopName: vendor.shopName,
        ownerName: vendor.ownerName,
        email: vendor.email,
        phone: vendor.phone,
        status: vendor.status,
        approvedBy: vendor.approvedBy,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function listVendors(_req, res, next) {
  try {
    const vendors = await Vendor.find().lean();
    return res.json({ vendors });
  } catch (error) {
    return next(error);
  }
}

async function listPendingVendors(_req, res, next) {
  try {
    const vendors = await Vendor.find({ status: 'pending' }).lean();
    return res.json({ vendors });
  } catch (error) {
    return next(error);
  }
}

async function getVendorById(req, res, next) {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id).lean();
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    return res.json({ vendor });
  } catch (error) {
    return next(error);
  }
}

/**
 * Get all vendor products (Admin can see all products from all vendors)
 * GET /api/admin/products
 */
async function getAllVendorProducts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      vendorId,
      categoryId,
      subCategoryId,
      brandId,
      isActive,
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Build query filter (no vendorId restriction - admin can see all)
    const filter = {};

    // Add optional filters
    if (vendorId) {
      filter.vendorId = vendorId;
    }

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (subCategoryId) {
      filter.subCategoryId = subCategoryId;
    }

    if (brandId) {
      filter.brandId = brandId;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    } else {
      // Default to active products only
      filter.isActive = true;
    }

    // Fetch products with pagination
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('-media') // Exclude media array for list view (can be large)
        .populate('vendorId', 'shopName ownerName email') // Populate vendor info
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    return res.json({
      success: true,
      message: 'Vendor products fetched successfully',
      data: {
        items: products.map((product) => ({
          id: product._id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          discountPrice: product.discountPrice,
          vendorId: product.vendorId,
          vendor: product.vendorId ? {
            id: product.vendorId._id || product.vendorId,
            shopName: product.vendorId.shopName,
            ownerName: product.vendorId.ownerName,
            email: product.vendorId.email,
          } : null,
          categoryId: product.categoryId,
          subCategoryId: product.subCategoryId,
          brandId: product.brandId,
          stock: product.stock,
          mainImage: product.mainImage,
          isActive: product.isActive,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages,
        },
      },
    });
  } catch (error) {
    console.error('Unexpected error in getAllVendorProducts:', error);
    return next(error);
  }
}

module.exports = {
  signup,
  login,
  logout,
  approveVendor,
  rejectVendor,
  listVendors,
  listPendingVendors,
  getVendorById,
  getAllVendorProducts,
};

