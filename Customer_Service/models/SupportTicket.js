const { Schema, model } = require('mongoose');

// Message schema (embedded in messages array)
const TicketMessageSchema = new Schema(
  {
    senderRole: {
      type: String,
      enum: ['customer', 'admin', 'super-admin', 'vendor'],
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'messages.senderRole', // Dynamic reference based on senderRole
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    _id: true,
  },
);

// Support Ticket schema
const SupportTicketSchema = new Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['order', 'payment', 'refund', 'product', 'account', 'general'],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    messages: {
      type: [TicketMessageSchema],
      default: [],
    },
    resolvedAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
SupportTicketSchema.index({ customerId: 1, createdAt: -1 });
SupportTicketSchema.index({ vendorId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ category: 1, status: 1 });

// Generate unique ticket number
SupportTicketSchema.statics.generateTicketNumber = function () {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TKT-${timestamp}-${random}`;
};

module.exports = model('SupportTicket', SupportTicketSchema);

