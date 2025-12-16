const { Schema, model } = require('mongoose');

const VendorSchema = new Schema(
  {
    shopName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      role: { type: String },
      approverId: { type: String },
      approverEmail: { type: String },
    },
    address: {
      state: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    bankDetails: {
      accountHolder: { type: String, required: true, trim: true },
      accountNumber: { type: String, required: true, trim: true },
      ifsc: { type: String, required: true, trim: true },
    },
    commissionRate: {
      type: Number,
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%'],
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, 'Total reviews cannot be negative'],
    },
    resetToken: { type: String },
    resetTokenExpiresAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = model('Vendor', VendorSchema);

