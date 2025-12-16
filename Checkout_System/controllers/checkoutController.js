const mongoose = require('mongoose');
const Cart = require('../../Cart_System/models/Cart');
const Product = require('../../Product/models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const Customer = require('../../Customer/models/Customer');

/**
 * Generate unique order number
 */
function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${timestamp}-${random}`;
}

/**
 * Calculate coupon discount
 */
function calculateCouponDiscount(coupon, amount) {
  if (!coupon) return 0;

  let discount = 0;

  if (coupon.discountType === 'PERCENTAGE') {
    discount = (amount * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else if (coupon.discountType === 'FIXED') {
    discount = Math.min(coupon.discountValue, amount);
  }

  return Math.round(discount * 100) / 100; // Round to 2 decimal places
}

/**
 * Checkout - Create orders from cart
 * POST /api/orders/checkout
 */
async function checkout(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { addressId, couponCode, paymentMethod } = req.body;
    const userId = req.userId; // From middleware

    // Validate payment method
    if (!paymentMethod || !['ONLINE', 'COD'].includes(paymentMethod)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment method must be either ONLINE or COD',
      });
    }

    // Fetch cart
    const cart = await Cart.findOne({ userId }).session(session);

    if (!cart || !cart.vendors || cart.vendors.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    // Fetch customer for address
    const customer = await Customer.findById(userId).session(session);
    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Use customer's address (for now, addressId validation can be added later for multiple addresses)
    const shippingAddress = customer.address;

    // Validate and fetch coupon if provided
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase().trim(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      }).session(session);

      if (!coupon) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired coupon code',
        });
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Coupon usage limit exceeded',
        });
      }
    }

    // Validate all products and check stock
    const productValidations = [];
    for (const vendor of cart.vendors) {
      for (const item of vendor.items) {
        productValidations.push(
          Product.findById(item.productId).session(session).then((product) => {
            if (!product) {
              throw new Error(`Product ${item.productId} not found`);
            }
            if (!product.isActive) {
              throw new Error(`Product ${product.name} is not available`);
            }
            if (product.stock < item.quantity) {
              throw new Error(
                `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
              );
            }
            return { product, item };
          }),
        );
      }
    }

    try {
      await Promise.all(productValidations);
    } catch (validationError) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    // Create orders vendor-wise
    const orders = [];
    const stockUpdates = [];

    for (const vendor of cart.vendors) {
      // Calculate vendor subtotal
      let vendorSubTotal = vendor.vendorSubTotal;

      // Apply coupon discount if applicable
      let vendorDiscount = 0;
      if (coupon) {
        if (
          coupon.applicableTo === 'PLATFORM' ||
          (coupon.applicableTo === 'VENDOR' &&
            coupon.vendorId &&
            coupon.vendorId.toString() === vendor.vendorId.toString()) ||
          coupon.applicableTo === 'ALL'
        ) {
          // Check minimum purchase amount
          if (vendorSubTotal >= coupon.minPurchaseAmount) {
            vendorDiscount = calculateCouponDiscount(coupon, vendorSubTotal);
          }
        }
      }

      const payableAmount = Math.max(0, vendorSubTotal - vendorDiscount);

      // Create order
      const order = new Order({
        orderNumber: generateOrderNumber(),
        userId: new mongoose.Types.ObjectId(userId),
        vendorId: vendor.vendorId,
        items: vendor.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.total,
        })),
        subTotal: vendorSubTotal,
        discount: vendorDiscount,
        payableAmount,
        orderStatus: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod,
        shippingAddress,
        couponCode: coupon ? coupon.code : undefined,
        couponDiscount: vendorDiscount,
      });

      orders.push(order);

      // Prepare stock updates
      for (const item of vendor.items) {
        stockUpdates.push({
          productId: item.productId,
          quantity: item.quantity,
        });
      }
    }

    // Deduct stock atomically
    for (const update of stockUpdates) {
      const result = await Product.findByIdAndUpdate(
        update.productId,
        { $inc: { stock: -update.quantity } },
        { session, new: true },
      );

      if (!result || result.stock < 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${update.productId}`,
        });
      }
    }

    // Save all orders
    const savedOrders = await Order.insertMany(orders, { session });

    // Update coupon usage count if applicable
    if (coupon) {
      await Coupon.findByIdAndUpdate(
        coupon._id,
        { $inc: { usedCount: 1 } },
        { session },
      );
    }

    // Clear cart
    await Cart.findByIdAndDelete(cart._id).session(session);

    // Calculate grand total
    const grandTotal = savedOrders.reduce((sum, order) => sum + order.payableAmount, 0);

    // Commit transaction
    await session.commitTransaction();

    // Prepare payment info (placeholder for payment gateway integration)
    let paymentInfo = null;
    if (paymentMethod === 'ONLINE') {
      // TODO: Integrate with Razorpay/Stripe
      // For now, return placeholder
      paymentInfo = {
        paymentIntentId: null, // Will be generated by payment gateway
        paymentUrl: null, // Will be generated by payment gateway
        message: 'Payment gateway integration pending',
      };
    }

    return res.json({
      success: true,
      message: 'Checkout initiated successfully',
      paymentRequired: paymentMethod === 'ONLINE',
      totalAmount: grandTotal,
      orderIds: savedOrders.map((order) => order._id),
      orders: savedOrders.map((order) => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        payableAmount: order.payableAmount,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
      })),
      paymentInfo,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in checkout:', error);
    return next(error);
  } finally {
    session.endSession();
  }
}

module.exports = {
  checkout,
};

