const express = require('express');
const {
  getAllTickets,
  replyToTicket,
  closeTicket,
} = require('../controllers/adminSupportController');
const { authenticateAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin support routes
router.get('/tickets', authenticateAdmin, getAllTickets);
router.post('/tickets/:id/reply', authenticateAdmin, replyToTicket);
router.put('/tickets/:id/close', authenticateAdmin, closeTicket);

module.exports = router;

