const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * Middleware to authenticate admin or super-admin
 * Extracts user info from JWT token
 */
async function authenticateAdmin(req, res, next) {
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
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.',
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token format',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Verify role is admin or super-admin
    const allowedRoles = ['admin', 'super-admin'];
    if (!allowedRoles.includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Super Admin role required.',
      });
    }

    // Validate user ID
    if (!decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User ID not found in token.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(decoded.sub)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
}

module.exports = {
  authenticateAdmin,
};

