const mongoose = require('mongoose');
const Product = require('../../Product/models/Product');
const { checkout } = require('../../Checkout_System/controllers/checkoutController');

/**
 * Buy Now - Direct order placement without cart
 * POST /api/orders/buy-now
 *
 * This endpoint allows customers to place an order directly from the product page
 * without adding the product to the cart. It creates a temporary cart structure
 * and reuses the existing checkout logic.
 */
async function buyNow(req, res, next) {
  try {
    const { productId, quantity, addressId, couponCode, paymentMethod } = req.body;
    const userId = req.userId; // From middleware

    // Validate required fields
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive number greater than 0',
      });
    }

    // Validate payment method
    if (!paymentMethod || !['ONLINE', 'COD'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Payment method must be either ONLINE or COD',
      });
    }

    // Validate productId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    // Fetch and validate product
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if product is active
    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available',
      });
    }

    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`,
      });
    }

    // Get vendorId from product
    const vendorId = product.vendorId;

    // Use product price (prefer discountPrice if available, else price)
    const itemPrice = product.discountPrice || product.price;
    const itemTotal = itemPrice * quantity;

    // Create temporary cart structure (not saved to database)
    const tempCart = {
      userId: new mongoose.Types.ObjectId(userId),
      vendors: [
        {
          vendorId: vendorId,
          items: [
            {
              productId: product._id,
              name: product.name,
              price: itemPrice,
              quantity: quantity,
              total: itemTotal,
            },
          ],
          vendorSubTotal: itemTotal,
        },
      ],
      grandTotal: itemTotal,
    };

    // Attach temporary cart to request object
    // This allows checkout to use it instead of fetching from database
    req.tempCart = tempCart;

    // Reuse existing checkout logic
    // The checkout function will check for req.tempCart first
    return checkout(req, res, next);
  } catch (error) {
    console.error('Error in buyNow:', error);
    return next(error);
  }
}

module.exports = {
  buyNow,
};

