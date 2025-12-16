const { Schema, model } = require('mongoose');

// Order item schema (embedded in items array)
const OrderItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative'],
    },
  },
  { _id: false },
);

// Order schema
const OrderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
    },
    subTotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    payableAmount: {
      type: Number,
      required: true,
      min: [0, 'Payable amount cannot be negative'],
    },
    orderStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'PACKED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'COD'],
      required: true,
    },
    paymentIntentId: {
      type: String,
      trim: true,
    },
    shippingAddress: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
    },
    couponCode: {
      type: String,
      trim: true,
    },
    couponDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Coupon discount cannot be negative'],
    },
    commission: {
      rate: {
        type: Number,
        min: [0, 'Commission rate cannot be negative'],
        max: [100, 'Commission rate cannot exceed 100%'],
      },
      platformAmount: {
        type: Number,
        min: [0, 'Platform commission cannot be negative'],
      },
      vendorAmount: {
        type: Number,
        min: [0, 'Vendor amount cannot be negative'],
      },
      calculatedAt: {
        type: Date,
      },
      walletCredited: {
        type: Boolean,
        default: false,
      },
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        updatedBy: {
          type: String,
          required: true,
          enum: ['vendor', 'admin', 'super-admin', 'system'],
        },
        updatedByUserId: {
          type: Schema.Types.ObjectId,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ vendorId: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, paymentStatus: 1 });

// Generate unique order number before saving
OrderSchema.pre('save', async function () {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }
});

module.exports = model('Order', OrderSchema);

