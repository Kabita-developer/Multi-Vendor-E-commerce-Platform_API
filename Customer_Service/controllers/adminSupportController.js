const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');

/**
 * Get all support tickets (admin/support)
 * GET /api/admin/support/tickets
 */
async function getAllTickets(req, res, next) {
  try {
    const { status, category, priority, customerId, vendorId, orderId, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};

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

    if (priority) {
      const validPriorities = ['low', 'medium', 'high'];
      if (validPriorities.includes(priority.toLowerCase())) {
        query.priority = priority.toLowerCase();
      }
    }

    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    }

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = vendorId;
    }

    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      query.orderId = orderId;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 50); // Max 50 per page

    // Get tickets
    const tickets = await SupportTicket.find(query)
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderNumber subTotal payableAmount')
      .populate('vendorId', 'shopName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const total = await SupportTicket.countDocuments(query);

    // Get statistics
    const stats = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusStats = {
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };

    stats.forEach((stat) => {
      statusStats[stat._id] = stat.count;
    });

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
        statistics: {
          byStatus: statusStats,
        },
      },
    });
  } catch (error) {
    console.error('Error in getAllTickets:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tickets',
    });
  }
}

/**
 * Reply to a ticket (admin/support)
 * POST /api/admin/support/tickets/:id/reply
 */
async function replyToTicket(req, res, next) {
  try {
    const userId = req.userId; // From middleware
    const userRole = req.user.role; // From middleware
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

    // Check if ticket is closed
    if (ticket.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reply to a closed ticket',
      });
    }

    // Determine sender role
    let senderRole = 'admin';
    if (userRole === 'super-admin') {
      senderRole = 'super-admin';
    }

    // Add message
    ticket.messages.push({
      senderRole,
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

/**
 * Close a ticket (admin/support)
 * PUT /api/admin/support/tickets/:id/close
 */
async function closeTicket(req, res, next) {
  try {
    const userId = req.userId; // From middleware
    const { id } = req.params;
    const { status } = req.body; // RESOLVED or CLOSED

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

    // Validate status
    const targetStatus = status ? status.toUpperCase() : 'CLOSED';
    if (!['RESOLVED', 'CLOSED'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either RESOLVED or CLOSED',
      });
    }

    // Check if already closed
    if (ticket.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        message: 'Ticket is already closed',
      });
    }

    // Update status
    ticket.status = targetStatus;

    if (targetStatus === 'RESOLVED') {
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = userId;
    } else if (targetStatus === 'CLOSED') {
      ticket.closedAt = new Date();
      ticket.closedBy = userId;
      // If closing, also set resolvedAt if not already set
      if (!ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
        ticket.resolvedBy = userId;
      }
    }

    await ticket.save();

    // Populate for response
    await ticket.populate('customerId', 'name email');
    await ticket.populate('orderId', 'orderNumber');
    await ticket.populate('vendorId', 'shopName');

    return res.json({
      success: true,
      message: `Ticket ${targetStatus.toLowerCase()} successfully`,
      data: {
        ticket,
      },
    });
  } catch (error) {
    console.error('Error in closeTicket:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to close ticket',
    });
  }
}

module.exports = {
  getAllTickets,
  replyToTicket,
  closeTicket,
};

