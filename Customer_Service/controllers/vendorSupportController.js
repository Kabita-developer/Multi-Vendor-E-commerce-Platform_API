const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');

/**
 * Get vendor-related support tickets
 * GET /api/vendor/support/tickets
 */
async function getVendorTickets(req, res, next) {
  try {
    const vendorId = req.vendorId; // From middleware
    const { status, category, page = 1, limit = 10 } = req.query;

    // Build query - only tickets related to this vendor
    const query = {
      $or: [
        { vendorId: vendorId },
        { orderId: { $exists: true } }, // Tickets with orders (we'll filter by vendor's orders)
      ],
    };

    // If vendorId is set, prioritize it
    if (vendorId) {
      query.$or = [{ vendorId: vendorId }];
    }

    if (status) {
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      if (validStatuses.includes(status.toUpperCase())) {
        query.status = status.toUpperCase();
      }
    }

    if (category) {
      const validCategories = ['order', 'payment', 'refund', 'product', 'account', 'general'];
      if (validCategories.includes(category.toLowerCase())) {
        query.category = category.toLowerCase();
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 50); // Max 50 per page

    // Get tickets
    let tickets = await SupportTicket.find(query)
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber vendorId subTotal')
      .populate('vendorId', 'shopName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Filter tickets to ensure they belong to this vendor
    // (check order's vendorId if ticket has orderId)
    tickets = tickets.filter((ticket) => {
      if (ticket.vendorId && ticket.vendorId._id.toString() === vendorId.toString()) {
        return true;
      }
      if (ticket.orderId && ticket.orderId.vendorId) {
        return ticket.orderId.vendorId.toString() === vendorId.toString();
      }
      return false;
    });

    // Get total count (approximate, since we filter after)
    const total = tickets.length;

    return res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          total,
          page: parseInt(page),
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Error in getVendorTickets:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tickets',
    });
  }
}

/**
 * Reply to a ticket (vendor)
 * POST /api/vendor/support/tickets/:id/reply
 */
async function replyToTicket(req, res, next) {
  try {
    const vendorId = req.vendorId; // From middleware
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID format',
      });
    }

    const ticket = await SupportTicket.findById(id)
      .populate('orderId', 'vendorId');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Verify vendor has access to this ticket
    let hasAccess = false;
    if (ticket.vendorId && ticket.vendorId.toString() === vendorId.toString()) {
      hasAccess = true;
    }
    if (ticket.orderId && ticket.orderId.vendorId && ticket.orderId.vendorId.toString() === vendorId.toString()) {
      hasAccess = true;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only reply to tickets related to your orders/products.',
      });
    }

    // Check if ticket is closed
    if (ticket.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reply to a closed ticket',
      });
    }

    // Add message
    ticket.messages.push({
      senderRole: 'vendor',
      senderId: vendorId,
      text: message.trim(),
    });

    // Update status to IN_PROGRESS if it was OPEN
    if (ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS';
    }

    await ticket.save();

    // Populate for response
    await ticket.populate('customerId', 'name email');
    await ticket.populate('orderId', 'orderNumber');
    await ticket.populate('vendorId', 'shopName');

    return res.json({
      success: true,
      message: 'Reply added successfully',
      data: {
        ticket,
      },
    });
  } catch (error) {
    console.error('Error in replyToTicket:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add reply',
    });
  }
}

module.exports = {
  getVendorTickets,
  replyToTicket,
};

