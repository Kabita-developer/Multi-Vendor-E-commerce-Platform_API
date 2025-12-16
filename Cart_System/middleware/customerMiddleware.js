const Customer = require('../../Customer/models/Customer');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * Middleware to authenticate customer
 * Extracts userId from JWT token and ensures role is "customer"
 */
async function authenticateCustomer(req, res, next) {
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

    let userId;
    let decoded;

    // Verify JWT token
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

    // Verify role is customer
    if (decoded.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Customer role required.',
      });
    }

    userId = decoded.sub;

    // Validate userId exists
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User ID not found in token.',
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    // Find customer to verify existence
    let customer;
    try {
      customer = await Customer.findById(userId);
    } catch (dbError) {
      console.error('Database error finding customer:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Error validating customer',
        ...(process.env.NODE_ENV === 'development' && { error: dbError.message }),
      });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Attach customer info to request
    req.customer = {
      id: customer._id.toString(),
      email: customer.email,
      name: customer.name,
    };

    // Set userId from token, never from body
    if (req.body && req.body.userId) {
      delete req.body.userId; // Remove if present
    }
    req.userId = customer._id.toString();

    next();
  } catch (error) {
    console.error('Customer authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
}

module.exports = {
  authenticateCustomer,
};

