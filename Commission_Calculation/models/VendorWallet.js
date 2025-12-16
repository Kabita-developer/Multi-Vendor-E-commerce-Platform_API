const { Schema, model } = require('mongoose');

// Transaction schema (embedded in transactions array)
const WalletTransactionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      // Can reference Order, WithdrawalRequest, etc.
    },
    description: {
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

const VendorWalletSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    holdBalance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Hold balance cannot be negative'],
    },
    transactions: {
      type: [WalletTransactionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
// Note: vendorId already has an index from unique: true constraint
VendorWalletSchema.index({ 'transactions.orderId': 1 });

// Ensure wallet exists or create it
VendorWalletSchema.statics.getOrCreateWallet = async function (vendorId) {
  let wallet = await this.findOne({ vendorId });
  if (!wallet) {
    wallet = await this.create({
      vendorId,
      balance: 0,
      holdBalance: 0,
      transactions: [],
    });
  }
  return wallet;
};

module.exports = model('VendorWallet', VendorWalletSchema);

