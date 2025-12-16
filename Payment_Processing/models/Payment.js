const { Schema, model } = require('mongoose');

const PaymentSchema = new Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gatewayOrderId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    orderIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
      },
    ],
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true,
    },
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'COD'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    gateway: {
      type: String,
      enum: ['RAZORPAY', 'STRIPE', 'COD'],
      required: true,
    },
    signature: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    verifiedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ paymentStatus: 1 });
PaymentSchema.index({ gatewayOrderId: 1, paymentStatus: 1 });

module.exports = model('Payment', PaymentSchema);

