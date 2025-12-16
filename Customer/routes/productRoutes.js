const express = require('express');
const { getProducts } = require('../controllers/productController');

const router = express.Router();

// Public route - Get all products (no authentication required)
router.get('/', getProducts);

module.exports = router;

