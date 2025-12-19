const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * Middleware to authenticate admin or super-admin
 */
async function authenticateAdmin(req, res, next) {
  try {
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
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Verify role is admin or super-admin
    if (decoded.role !== 'admin' && decoded.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Super Admin role required.',
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };
    req.userId = decoded.sub;

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

