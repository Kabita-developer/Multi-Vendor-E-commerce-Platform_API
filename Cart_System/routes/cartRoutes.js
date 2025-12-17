const express = require('express');
const {
  addToCart,
  getCart,
  removeFromCart,
  clearCart,
} = require('../controllers/cartController');
const { authenticateCustomer } = require('../middleware/customerMiddleware');

const router = express.Router();

// Protected route - Add item to cart (Authenticated Customer only)
router.post('/add', authenticateCustomer, addToCart);

// Protected route - Update cart (alias to addToCart: adds or updates quantity)
// Used by docs as POST /api/cart/update
router.post('/update', authenticateCustomer, addToCart);

// Protected route - Get cart (Authenticated Customer only)
router.get('/', authenticateCustomer, getCart);

// Protected route - Remove single item from cart
router.post('/remove', authenticateCustomer, removeFromCart);

// Protected route - Clear entire cart
router.post('/clear', authenticateCustomer, clearCart);

module.exports = router;

