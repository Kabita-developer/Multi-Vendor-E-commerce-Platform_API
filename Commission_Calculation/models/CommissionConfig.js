const { Schema, model } = require('mongoose');

const CommissionConfigSchema = new Schema(
  {
    globalRate: {
      type: Number,
      required: true,
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%'],
      default: 10, // Default 10%
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      refPath: 'updatedByRole',
    },
    updatedByRole: {
      type: String,
      enum: ['SuperAdmin', 'Admin'],
    },
  },
  {
    timestamps: true,
  },
);

// Ensure only one commission config exists
CommissionConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({ globalRate: 10 });
  }
  return config;
};

module.exports = model('CommissionConfig', CommissionConfigSchema);

