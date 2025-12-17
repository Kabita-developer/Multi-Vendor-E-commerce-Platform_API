const express = require('express');
const { searchProducts, searchHealth } = require('../controllers/searchController');
const { syncAllProducts, createIndex, updateIndexSettings } = require('../controllers/syncController');

const router = express.Router();

// Public search endpoint
router.get('/search', searchProducts);

// Health check endpoint
router.get('/health', searchHealth);

// Admin sync endpoints (optional - can be protected with admin middleware)
router.post('/sync', syncAllProducts);
router.post('/index/create', createIndex);
router.post('/index/update-settings', updateIndexSettings);

module.exports = router;

