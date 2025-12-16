const Vendor = require('../../Vendor/models/Vendor');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * Middleware to authenticate vendor and verify approval status
 * Extracts vendorId from JWT token and ensures vendor is approved
 */
async function authenticateVendor(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header is required',
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader; // Support both "Bearer TOKEN" and just "TOKEN"

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required',
      });
    }

    let vendorId;
    let isJWT = false;

    // Try to verify as JWT first
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'vendor') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Vendor role required.',
        });
      }
      vendorId = decoded.sub;
      isJWT = true;
    } catch (jwtError) {
      // If JWT verification fails, check if token is a plain vendor ID
      // This handles the legacy token format where vendor.id was used as token
      // Only treat as plain ID if it looks like a MongoDB ObjectId (24 hex characters)
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.',
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        // Not a valid JWT, try as plain vendor ID
        if (/^[0-9a-fA-F]{24}$/.test(token)) {
          vendorId = token;
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid token format',
          });
        }
      } else {
        // Other JWT errors - try as plain vendor ID if it looks like ObjectId
        if (mongoose.Types.ObjectId.isValid(token)) {
          vendorId = token;
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
          });
        }
      }
    }

    // Validate vendorId exists
    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Vendor ID not found in token.',
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid vendor ID format',
      });
    }

    // Find vendor and verify approval status
    let vendor;
    try {
      vendor = await Vendor.findById(vendorId);
    } catch (dbError) {
      console.error('Database error finding vendor:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Error validating vendor',
        ...(process.env.NODE_ENV === 'development' && { error: dbError.message }),
      });
    }
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    if (vendor.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Vendor account is not approved. Current status: ${vendor.status}`,
      });
    }

    // Attach vendor info to request
    req.vendor = {
      id: vendor._id.toString(),
      email: vendor.email,
      shopName: vendor.shopName,
      status: vendor.status,
    };

    // Ensure vendorId is set from token, never from body
    if (req.body && req.body.vendorId) {
      delete req.body.vendorId; // Remove if present
    }
    req.vendorId = vendor._id.toString();

    next();
  } catch (error) {
    console.error('Vendor authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
}

module.exports = {
  authenticateVendor,
};

