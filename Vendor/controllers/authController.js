const Vendor = require('../models/Vendor');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function signup(req, res, next) {
  try {
    const {
      shopName,
      ownerName,
      email,
      phone,
      password,
      address,
      bankDetails,
    } = req.body || {};

    // Basic required checks
    if (!shopName || !ownerName || !email || !phone || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (
      !address ||
      !address.state ||
      !address.city ||
      !address.pincode ||
      !bankDetails ||
      !bankDetails.accountHolder ||
      !bankDetails.accountNumber ||
      !bankDetails.ifsc
    ) {
      return res
        .status(400)
        .json({ message: 'Address and bank details are required' });
    }

    const existing = await Vendor.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Vendor already exists' });
    }

    const vendor = await Vendor.create({
      shopName,
      ownerName,
      email,
      phone,
      password,
      address,
      bankDetails,
    });

    return res.status(201).json({
      message: 'Signup successfully, now wait for admin approval',
      vendor: {
        id: vendor.id,
        shopName: vendor.shopName,
        ownerName: vendor.ownerName,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        bankDetails: vendor.bankDetails,
        status: vendor.status,
        approvedBy: vendor.approvedBy,
        createdAt: vendor.createdAt,
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

    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (vendor.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (vendor.status !== 'approved') {
      return res
        .status(403)
        .json({ message: 'Vendor not approved yet', status: vendor.status });
    }

    // Generate JWT token for the vendor
    const token = jwt.sign(
      {
        sub: vendor.id,
        role: 'vendor',
        email: vendor.email,
      },
      JWT_SECRET,
      { expiresIn: '2h' },
    );

    return res.json({
      message: 'Login successful',
      token,
      vendor: {
        id: vendor.id,
        shopName: vendor.shopName,
        ownerName: vendor.ownerName,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        bankDetails: vendor.bankDetails,
        status: vendor.status,
        approvedBy: vendor.approvedBy,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(_req, res, next) {
  try {
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
}

async function updateVendor(req, res, next) {
  try {
    const idFromParams = req.params?.id;
    const { id: idFromBody, _id: idFromBodyAlt, ...updates } = req.body || {};
    const authHeader = req.headers.authorization || '';
    const bearerId =
      authHeader.startsWith('Bearer ') && authHeader.replace('Bearer ', '').trim();
    const id = idFromParams || idFromBody || idFromBodyAlt || bearerId;
    if (!id) {
      return res.status(400).json({
        message:
          'Vendor id is required (pass as URL /update/:id, in body id, or as Bearer token)',
      });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true, lean: true },
    );

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    return res.json({
      message: 'Vendor updated',
      vendor,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteVendor(req, res, next) {
  try {
    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ message: 'Vendor id is required' });
    }

    const vendor = await Vendor.findByIdAndDelete(id).lean();
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    return res.json({
      message: 'Vendor deleted',
      vendor,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signup,
  login,
  logout,
  updateVendor,
  deleteVendor,
};

