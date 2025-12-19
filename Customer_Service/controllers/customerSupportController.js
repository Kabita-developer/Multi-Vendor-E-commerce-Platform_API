const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');
const Order = require('../../Checkout_System/models/Order');

/**
 * Create a new support ticket
 * POST /api/support/tickets
 */
async function createTicket(req, res, next) {
  try {
    const userId = req.userId; // From middleware
    const { subject, category, priority, orderId, vendorId, message } = req.body;

    // Validate required fields
    if (!subject || !category || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject, category, and message are required',
      });
    }

    // Validate category
    const validCategories = ['order', 'payment', 'refund', 'product', 'account', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`,
      });
    }

    // If orderId is provided, validate it belongs to the customer
    if (orderId) {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid order ID format',
        });
      }

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      if (order.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only create tickets for your own orders',
        });
      }

      // If orderId is provided, automatically set vendorId from order
      if (order.vendorId) {
        req.body.vendorId = order.vendorId.toString();
      }
    }

    // If vendorId is provided, validate it
    if (vendorId) {
      if (!mongoose.Types.ObjectId.isValid(vendorId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid vendor ID format',
        });
      }
    }

    // Generate unique ticket number
    let ticketNumber;
    let isUnique = false;
    while (!isUnique) {
      ticketNumber = SupportTicket.generateTicketNumber();
      const existing = await SupportTicket.findOne({ ticketNumber });
      if (!existing) {
        isUnique = true;
      }
    }

    // Create ticket
    const ticket = await SupportTicket.create({
      ticketNumber,
      customerId: userId,
      orderId: orderId || undefined,
      vendorId: vendorId || undefined,
      subject: subject.trim(),
      category,
      priority: priority || 'medium',
      status: 'OPEN',
      messages: [
        {
          senderRole: 'customer',
          senderId: userId,
          text: message.trim(),
        },
      ],
    });

    // Populate customer and order details
    await ticket.populate('customerId', 'name email');
    if (ticket.orderId) {
      await ticket.populate('orderId', 'orderNumber');
    }
    if (ticket.vendorId) {
      await ticket.populate('vendorId', 'shopName');
    }

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: {
        ticket,
      },
    });
  } catch (error) {
    console.error('Error in createTicket:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create support ticket',
    });
  }
}

/**
 * Get customer's own tickets
 * GET /api/support/tickets/my
 */
async function getMyTickets(req, res, next) {
  try {
    const userId = req.userId; // From middleware
    const { status, category, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { customerId: userId };

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
    const tickets = await SupportTicket.find(query)
      .populate('orderId', 'orderNumber')
      .populate('vendorId', 'shopName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const total = await SupportTicket.countDocuments(query);

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
    console.error('Error in getMyTickets:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tickets',
    });
  }
}

/**
 * Get ticket by ID (customer's own ticket only)
 * GET /api/support/tickets/:id
 */
async function getTicketById(req, res, next) {
  try {
    const userId = req.userId; // From middleware
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID format',
      });
    }

    const ticket = await SupportTicket.findById(id)
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber subTotal payableAmount')
      .populate('vendorId', 'shopName email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Verify customer owns this ticket
    if (ticket.customerId._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own tickets.',
      });
    }

    return res.json({
      success: true,
      data: {
        ticket,
      },
    });
  } catch (error) {
    console.error('Error in getTicketById:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch ticket',
    });
  }
}

/**
 * Reply to a ticket (customer)
 * POST /api/support/tickets/:id/reply
 */
async function replyToTicket(req, res, next) {
  try {
    const userId = req.userId; // From middleware
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

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Verify customer owns this ticket
    if (ticket.customerId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only reply to your own tickets.',
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
      senderRole: 'customer',
      senderId: userId,
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
  createTicket,
  getMyTickets,
  getTicketById,
  replyToTicket,
};

