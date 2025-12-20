const express = require('express');
const {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} = require('../controllers/wishlistController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');

const router = express.Router();

// Protected routes - Wishlist (Authenticated Customer only)
router.post('/add', authenticateCustomer, addToWishlist);
router.get('/', authenticateCustomer, getWishlist);
router.post('/remove/:id', authenticateCustomer, removeFromWishlist);

module.exports = router;

