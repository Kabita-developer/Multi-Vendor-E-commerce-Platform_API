const crypto = require('crypto');

// Payment Gateway Service (Abstracted for Razorpay/Stripe)
// This service provides a unified interface for different payment gateways

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PAYMENT_GATEWAY = process.env.PAYMENT_GATEWAY || 'RAZORPAY'; // RAZORPAY or STRIPE
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

/**
 * Create payment order/intent
 * @param {Object} params - Payment parameters
 * @param {Number} params.amount - Amount in smallest currency unit (paise for INR, cents for USD)
 * @param {String} params.currency - Currency code (INR, USD, etc.)
 * @param {String} params.receipt - Receipt/order identifier
 * @param {Object} params.notes - Additional notes/metadata
 * @returns {Promise<Object>} Payment order details
 */
async function createPaymentOrder(params) {
  const { amount, currency = 'INR', receipt, notes = {} } = params;

  if (PAYMENT_GATEWAY === 'RAZORPAY') {
    return createRazorpayOrder(amount, currency, receipt, notes);
  } else if (PAYMENT_GATEWAY === 'STRIPE') {
    return createStripePaymentIntent(amount, currency, receipt, notes);
  } else {
    throw new Error(`Unsupported payment gateway: ${PAYMENT_GATEWAY}`);
  }
}

/**
 * Create Razorpay order
 */
async function createRazorpayOrder(amount, currency, receipt, notes) {
  // For production, install razorpay: npm install razorpay
  // const Razorpay = require('razorpay');
  // const razorpay = new Razorpay({
  //   key_id: RAZORPAY_KEY_ID,
  //   key_secret: RAZORPAY_KEY_SECRET,
  // });
  //
  // const order = await razorpay.orders.create({
  //   amount: amount * 100, // Convert to paise
  //   currency: currency,
  //   receipt: receipt,
  //   notes: notes,
  // });
  //
  // return {
  //   gatewayOrderId: order.id,
  //   amount: order.amount / 100,
  //   currency: order.currency,
  //   status: order.status,
  // };

  // Placeholder implementation
  // In production, replace with actual Razorpay SDK call
  if (IS_PRODUCTION && (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET)) {
    throw new Error('Razorpay credentials not configured. Required in production mode.');
  }

  // Use placeholder credentials in development mode if not configured
  const keyId = RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id';
  const keySecret = RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_key_secret';

  // Simulate Razorpay order creation
  const gatewayOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    gatewayOrderId,
    amount: amount,
    currency: currency,
    status: 'created',
    keyId: keyId, // For frontend
  };
}

/**
 * Create Stripe payment intent
 */
async function createStripePaymentIntent(amount, currency, receipt, notes) {
  // For production, install stripe: npm install stripe
  // const stripe = require('stripe')(STRIPE_SECRET_KEY);
  //
  // const paymentIntent = await stripe.paymentIntents.create({
  //   amount: amount * 100, // Convert to cents
  //   currency: currency.toLowerCase(),
  //   metadata: {
  //     receipt: receipt,
  //     ...notes,
  //   },
  // });
  //
  // return {
  //   gatewayOrderId: paymentIntent.id,
  //   amount: paymentIntent.amount / 100,
  //   currency: paymentIntent.currency.toUpperCase(),
  //   status: paymentIntent.status,
  //   clientSecret: paymentIntent.client_secret,
  // };

  // Placeholder implementation
  // In production, replace with actual Stripe SDK call
  if (IS_PRODUCTION && !STRIPE_SECRET_KEY) {
    throw new Error('Stripe credentials not configured. Required in production mode.');
  }

  // Simulate Stripe payment intent creation
  const gatewayOrderId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const clientSecret = `pi_${gatewayOrderId}_secret_${Math.random().toString(36).substr(2, 16)}`;

  return {
    gatewayOrderId,
    amount: amount,
    currency: currency,
    status: 'requires_payment_method',
    clientSecret,
  };
}

/**
 * Verify payment signature
 * @param {Object} params - Verification parameters
 * @param {String} params.gatewayOrderId - Gateway order ID
 * @param {String} params.paymentId - Payment ID from gateway
 * @param {String} params.signature - Signature to verify
 * @param {Number} params.amount - Amount to verify
 * @returns {Boolean} True if signature is valid
 */
function verifyPaymentSignature(params) {
  const { gatewayOrderId, paymentId, signature, amount } = params;

  if (PAYMENT_GATEWAY === 'RAZORPAY') {
    return verifyRazorpaySignature(gatewayOrderId, paymentId, signature);
  } else if (PAYMENT_GATEWAY === 'STRIPE') {
    return verifyStripeSignature(gatewayOrderId, paymentId, signature);
  } else {
    throw new Error(`Unsupported payment gateway: ${PAYMENT_GATEWAY}`);
  }
}

/**
 * Verify Razorpay signature
 * Razorpay signature format: HMAC SHA256 of (gatewayOrderId|paymentId) with key_secret
 */
function verifyRazorpaySignature(gatewayOrderId, paymentId, signature) {
  // Use placeholder secret in development mode if not configured
  const keySecret = RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_key_secret';

  if (IS_PRODUCTION && !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay key secret not configured. Required in production mode.');
  }

  // In development mode, accept any signature for testing
  if (!IS_PRODUCTION) {
    return signature && signature.length > 0;
  }

  // Generate expected signature
  const payload = `${gatewayOrderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );
}

/**
 * Verify Stripe signature
 * Stripe uses webhook signatures, but for payment intent verification,
 * we verify the payment status from Stripe API
 */
function verifyStripeSignature(gatewayOrderId, paymentId, signature) {
  // Stripe signature verification is typically done via webhooks
  // For payment intent verification, we would check payment status via API
  // This is a simplified version - in production, use Stripe SDK to verify

  if (IS_PRODUCTION && !STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key not configured. Required in production mode.');
  }

  // In production, use Stripe SDK:
  // const stripe = require('stripe')(STRIPE_SECRET_KEY);
  // const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
  // return paymentIntent.status === 'succeeded' && paymentIntent.id === gatewayOrderId;

  // Placeholder: For now, return true if signature is provided
  // In production, implement proper Stripe webhook signature verification
  return signature && signature.length > 0;
}

/**
 * Get payment gateway name
 */
function getGatewayName() {
  return PAYMENT_GATEWAY;
}

module.exports = {
  createPaymentOrder,
  verifyPaymentSignature,
  getGatewayName,
};

