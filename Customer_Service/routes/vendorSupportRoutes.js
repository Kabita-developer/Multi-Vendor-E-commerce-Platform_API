const express = require('express');
const {
  getVendorTickets,
  replyToTicket,
} = require('../controllers/vendorSupportController');
const { authenticateVendor } = require('../../Product/middleware/vendorMiddleware');

const router = express.Router();

// Vendor support routes
router.get('/tickets', authenticateVendor, getVendorTickets);
router.post('/tickets/:id/reply', authenticateVendor, replyToTicket);

module.exports = router;

