const Coupon = require('../models/Coupon');

function randomCouponCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid confusing chars (I/O/1/0)
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function generateUniqueCouponCode({ length = 8, prefix = '' } = {}) {
  const normalizedPrefix = (prefix || '').toString().trim().toUpperCase();
  const codeLength = Math.max(4, Math.min(parseInt(length, 10) || 8, 20));

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const candidate = `${normalizedPrefix}${randomCouponCode(codeLength)}`;
    // Ensure uniqueness
    // eslint-disable-next-line no-await-in-loop
    const exists = await Coupon.exists({ code: candidate });
    if (!exists) return candidate;
  }

  throw new Error('Failed to generate a unique coupon code. Please try again.');
}

/**
 * Admin: Generate a unique coupon code (not saved)
 * POST /api/admin/coupons/generate-code
 */
async function generateCode(req, res, next) {
  try {
    const { length, prefix } = req.body || {};
    const code = await generateUniqueCouponCode({ length, prefix });
    return res.json({ success: true, code });
  } catch (error) {
    return next(error);
  }
}

/**
 * Admin: Create a coupon (auto-generates code if not provided)
 * POST /api/admin/coupons
 */
async function createCoupon(req, res, next) {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      applicableTo,
      vendorId,
      validFrom,
      validUntil,
      usageLimit,
      isActive,
      // optional generator params if code not provided
      codeLength,
      codePrefix,
    } = req.body || {};

    if (!discountType || !discountValue || !validFrom || !validUntil) {
      return res.status(400).json({
        success: false,
        message: 'discountType, discountValue, validFrom, validUntil are required',
      });
    }

    const from = new Date(validFrom);
    const until = new Date(validUntil);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'validFrom and validUntil must be valid dates',
      });
    }
    if (from > until) {
      return res.status(400).json({
        success: false,
        message: 'validFrom must be before (or equal to) validUntil',
      });
    }

    let finalCode = code ? code.toString().trim().toUpperCase() : '';
    if (!finalCode) {
      finalCode = await generateUniqueCouponCode({
        length: codeLength,
        prefix: codePrefix,
      });
    }

    const existing = await Coupon.findOne({ code: finalCode }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Coupon code already exists',
      });
    }

    const coupon = await Coupon.create({
      code: finalCode,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      applicableTo,
      vendorId,
      validFrom: from,
      validUntil: until,
      usageLimit,
      isActive,
    });

    return res.status(201).json({
      success: true,
      message: 'Coupon created',
      coupon,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  generateCode,
  createCoupon,
};


