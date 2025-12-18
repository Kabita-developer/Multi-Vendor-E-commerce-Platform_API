const mongoose = require('mongoose');
const Order = require('../../Checkout_System/models/Order');
const Payment = require('../models/Payment');
const Product = require('../../Product/models/Product');
const paymentGateway = require('../services/paymentGateway');
const commissionService = require('../../Commission_Calculation/services/commissionService');

/**
 * Create payment
 * POST /api/payment/create
 */
async function createPayment(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderIds, amount, currency = 'INR' } = req.body;
    const userId = req.userId; // From middleware

    // Validate required fields
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order IDs are required and must be a non-empty array',
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Amount is required and must be a positive number',
      });
    }

    // Validate order IDs format
    const validOrderIds = orderIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validOrderIds.length !== orderIds.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Fetch orders and validate ownership and status
    const orders = await Order.find({
      _id: { $in: validOrderIds },
      userId: new mongoose.Types.ObjectId(userId),
    }).session(session);

    if (orders.length !== orderIds.length) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Some orders not found or do not belong to you',
      });
    }

    // Validate all orders have paymentStatus = PENDING
    const pendingOrders = orders.filter((order) => order.paymentStatus === 'PENDING');
    if (pendingOrders.length !== orders.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Some orders are already processed or cancelled',
      });
    }

    // Validate payment method is ONLINE
    const onlineOrders = orders.filter((order) => order.paymentMethod === 'ONLINE');
    if (onlineOrders.length !== orders.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'All orders must have payment method ONLINE',
      });
    }

    // Calculate total amount from orders
    const totalAmount = orders.reduce((sum, order) => sum + order.payableAmount, 0);

    // Validate amount matches (allow small rounding differences)
    if (Math.abs(totalAmount - amount) > 0.01) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Amount mismatch. Expected: ${totalAmount}, Provided: ${amount}`,
      });
    }

    // Generate unique payment ID
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment order with gateway
    let gatewayResponse;
    try {
      gatewayResponse = await paymentGateway.createPaymentOrder({
        amount: amount,
        currency: currency,
        receipt: paymentId,
        notes: {
          userId: userId,
          orderIds: validOrderIds.join(','),
        },
      });
    } catch (gatewayError) {
      await session.abortTransaction();
      console.error('Payment gateway error:', gatewayError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order with gateway',
        error: process.env.NODE_ENV === 'development' ? gatewayError.message : undefined,
      });
    }

    // Create payment record
    const payment = new Payment({
      paymentId,
      gatewayOrderId: gatewayResponse.gatewayOrderId,
      userId: new mongoose.Types.ObjectId(userId),
      orderIds: validOrderIds.map((id) => new mongoose.Types.ObjectId(id)),
      amount,
      currency: currency.toUpperCase(),
      paymentMethod: 'ONLINE',
      paymentStatus: 'PENDING',
      gateway: paymentGateway.getGatewayName(),
      metadata: {
        gatewayResponse,
      },
    });

    await payment.save({ session });

    // Update orders with payment reference
    await Order.updateMany(
      { _id: { $in: validOrderIds } },
      {
        $set: {
          paymentIntentId: gatewayResponse.gatewayOrderId,
        },
      },
      { session },
    );

    await session.commitTransaction();

    return res.json({
      success: true,
      paymentId: payment.paymentId,
      gatewayOrderId: gatewayResponse.gatewayOrderId,
      amount: amount,
      currency: currency.toUpperCase(),
      keyId: gatewayResponse.keyId, // For Razorpay frontend
      clientSecret: gatewayResponse.clientSecret, // For Stripe frontend
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in createPayment:', error);
    return next(error);
  } finally {
    session.endSession();
  }
}

/**
 * Verify payment
 * POST /api/payment/verify
 */
async function verifyPayment(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { paymentId, gatewayOrderId, signature, orderIds } = req.body;
    const userId = req.userId; // From middleware

    // Validate required fields
    if (!paymentId || !gatewayOrderId || !signature) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment ID, Gateway Order ID, and Signature are required',
      });
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order IDs are required',
      });
    }

    // Fetch payment record
    const payment = await Payment.findOne({
      paymentId,
      userId: new mongoose.Types.ObjectId(userId),
    }).session(session);

    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Check if already verified (idempotent)
    if (payment.paymentStatus === 'PAID') {
      await session.abortTransaction();
      return res.json({
        success: true,
        message: 'Payment already verified',
        ordersConfirmed: orderIds,
      });
    }

    // Verify signature
    let isSignatureValid;
    try {
      isSignatureValid = paymentGateway.verifyPaymentSignature({
        gatewayOrderId: payment.gatewayOrderId,
        paymentId: gatewayOrderId, // In Razorpay, this is the payment ID from gateway
        signature,
        amount: payment.amount,
      });
    } catch (verifyError) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: 'Payment verification failed',
        error: process.env.NODE_ENV === 'development' ? verifyError.message : undefined,
      });
    }

    // Fetch orders
    const orders = await Order.find({
      _id: { $in: orderIds },
      userId: new mongoose.Types.ObjectId(userId),
    }).session(session);

    if (orders.length !== orderIds.length) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Some orders not found or do not belong to you',
      });
    }

    if (!isSignatureValid) {
      // Payment verification failed - rollback stock and cancel orders
      for (const order of orders) {
        // Rollback stock for each item
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: item.quantity } },
            { session },
          );
        }

        // Update order status
        await Order.findByIdAndUpdate(
          order._id,
          {
            $set: {
              paymentStatus: 'FAILED',
              orderStatus: 'CANCELLED',
            },
          },
          { session },
        );
      }

      // Update payment status
      payment.paymentStatus = 'FAILED';
      payment.failureReason = 'Signature verification failed';
      await payment.save({ session });

      await session.commitTransaction();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Orders cancelled and stock restored.',
      });
    }

    // Payment verified successfully
    // Update orders
    for (const order of orders) {
      await Order.findByIdAndUpdate(
        order._id,
        {
          $set: {
            paymentStatus: 'PAID',
            orderStatus: 'CONFIRMED',
          },
        },
        { session },
      );
    }

    // Update payment status
    payment.paymentStatus = 'PAID';
    payment.signature = signature;
    payment.verifiedAt = new Date();
    await payment.save({ session });

    await session.commitTransaction();

    // Process commission and credit vendor wallets (outside transaction)
    // This runs after transaction commit to avoid blocking payment verification
    try {
      await commissionService.processCommissionForOrders(
        orders.map((o) => o._id.toString()),
      );
    } catch (commissionError) {
      // Log error but don't fail the payment verification
      console.error('Error processing commission after payment verification:', commissionError);
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully',
      ordersConfirmed: orders.map((order) => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: 'CONFIRMED',
        paymentStatus: 'PAID',
      })),
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in verifyPayment:', error);
    return next(error);
  } finally {
    session.endSession();
  }
}

/**
 * Cash on Delivery (COD)
 * POST /api/payment/cod
 */
async function confirmCOD(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderIds } = req.body;
    const userId = req.userId; // From middleware

    // Validate required fields
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order IDs are required and must be a non-empty array',
      });
    }

    // Validate order IDs format
    const validOrderIds = orderIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validOrderIds.length !== orderIds.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    // Fetch orders and validate ownership
    const orders = await Order.find({
      _id: { $in: validOrderIds },
      userId: new mongoose.Types.ObjectId(userId),
    }).session(session);

    if (orders.length !== orderIds.length) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Some orders not found or do not belong to you',
      });
    }

    // Validate all orders have paymentMethod = COD
    const codOrders = orders.filter((order) => order.paymentMethod === 'COD');
    if (codOrders.length !== orders.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'All orders must have payment method COD',
      });
    }

    // Validate orders are in PENDING status
    const pendingOrders = orders.filter(
      (order) => order.paymentStatus === 'PENDING' && order.orderStatus === 'PENDING',
    );
    if (pendingOrders.length !== orders.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Some orders are already processed',
      });
    }

    // Update orders
    for (const order of orders) {
      await Order.findByIdAndUpdate(
        order._id,
        {
          $set: {
            paymentMethod: 'COD',
            paymentStatus: 'PENDING', // Will be updated to PAID on delivery
            orderStatus: 'CONFIRMED',
          },
        },
        { session },
      );
    }

    await session.commitTransaction();

    // Process commission and credit vendor wallets (outside transaction)
    // COD orders are eligible for commission when CONFIRMED
    try {
      await commissionService.processCommissionForOrders(
        orders.map((o) => o._id.toString()),
      );
    } catch (commissionError) {
      // Log error but don't fail the COD confirmation
      console.error('Error processing commission after COD confirmation:', commissionError);
    }

    return res.json({
      success: true,
      message: 'Order placed with Cash on Delivery',
      ordersConfirmed: orders.map((order) => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: 'CONFIRMED',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
      })),
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in confirmCOD:', error);
    return next(error);
  } finally {
    session.endSession();
  }
}

module.exports = {
  createPayment,
  verifyPayment,
  confirmCOD,
};

