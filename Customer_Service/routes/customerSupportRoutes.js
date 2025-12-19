const express = require('express');
const {
  createTicket,
  getMyTickets,
  getTicketById,
  replyToTicket,
} = require('../controllers/customerSupportController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');

const router = express.Router();

// Customer support routes
router.post('/tickets', authenticateCustomer, createTicket);
router.get('/tickets/my', authenticateCustomer, getMyTickets);
router.get('/tickets/:id', authenticateCustomer, getTicketById);
router.post('/tickets/:id/reply', authenticateCustomer, replyToTicket);

module.exports = router;

