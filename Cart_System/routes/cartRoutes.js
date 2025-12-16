const express = require('express');
const { addToCart, getCart } = require('../controllers/cartController');
const { authenticateCustomer } = require('../middleware/customerMiddleware');

const router = express.Router();

// Protected route - Add item to cart (Authenticated Customer only)
router.post('/add', authenticateCustomer, addToCart);

// Protected route - Get cart (Authenticated Customer only)
router.get('/', authenticateCustomer, getCart);

module.exports = router;

