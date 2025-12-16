const { Schema, model } = require('mongoose');

const WithdrawalRequestSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Withdrawal amount must be greater than 0'],
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
    rejectedAt: {
      type: Date,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
    },
    paymentReference: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
WithdrawalRequestSchema.index({ vendorId: 1, status: 1 });
WithdrawalRequestSchema.index({ vendorId: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = model('WithdrawalRequest', WithdrawalRequestSchema);

