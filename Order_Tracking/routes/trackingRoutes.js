const express = require('express');
const { trackOrder } = require('../controllers/trackingController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');

const router = express.Router();

// Protected route - Track order (Authenticated Customer only)
router.get('/:id/track', authenticateCustomer, trackOrder);

module.exports = router;

