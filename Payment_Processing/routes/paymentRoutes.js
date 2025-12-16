const express = require('express');
const { createPayment, verifyPayment, confirmCOD } = require('../controllers/paymentController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');

const router = express.Router();

// Protected routes - All require authenticated customer
router.post('/create', authenticateCustomer, createPayment);
router.post('/verify', authenticateCustomer, verifyPayment);
router.post('/cod', authenticateCustomer, confirmCOD);

module.exports = router;

