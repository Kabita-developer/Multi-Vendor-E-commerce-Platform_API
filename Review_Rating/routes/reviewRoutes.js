const express = require('express');
const { submitReview } = require('../controllers/reviewController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');

const router = express.Router();

// Protected route - Submit review (Authenticated Customer only)
router.post('/:productId', authenticateCustomer, submitReview);

module.exports = router;

