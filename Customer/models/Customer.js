const { Schema, model } = require('mongoose');

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'customer' },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
    },
    resetToken: { type: String },
    resetTokenExpiresAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = model('Customer', CustomerSchema);

