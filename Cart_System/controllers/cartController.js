const Cart = require('../models/Cart');
const Product = require('../../Product/models/Product');
const mongoose = require('mongoose');

/**
 * Add item to cart
 * POST /api/cart/add
 *
 * Request Body:
 * {
 *   "productId": "PRODUCT_ID",
 *   "quantity": 2
 * }
 */
async function addToCart(req, res, next) {
  try {
    const { productId, quantity } = req.body;
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

    // Validate productId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    // Find product
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

    // Find or create cart
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // Create new cart
      cart = new Cart({
        userId,
        vendors: [],
        grandTotal: 0,
      });
    }

    // Find vendor in cart
    const vendorIndex = cart.vendors.findIndex(
      (v) => v.vendorId.toString() === vendorId.toString(),
    );

    if (vendorIndex !== -1) {
      // Vendor bucket exists
      const vendor = cart.vendors[vendorIndex];

      // Check if product already exists in vendor's items
      const productIndex = vendor.items.findIndex(
        (item) => item.productId.toString() === productId.toString(),
      );

      if (productIndex !== -1) {
        // Product exists - update quantity and total
        const existingItem = vendor.items[productIndex];
        const newQuantity = existingItem.quantity + quantity;

        // Check stock for updated quantity
        if (product.stock < newQuantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock. Available: ${product.stock}, Requested total quantity: ${newQuantity}`,
          });
        }

        existingItem.quantity = newQuantity;
        existingItem.total = itemPrice * newQuantity;
      } else {
        // Product doesn't exist - add new item
        vendor.items.push({
          productId: new mongoose.Types.ObjectId(productId),
          name: product.name,
          price: itemPrice,
          quantity,
          total: itemTotal,
        });
      }

      // Recalculate vendor subtotal
      vendor.vendorSubTotal = vendor.items.reduce(
        (sum, item) => sum + item.total,
        0,
      );
    } else {
      // Vendor bucket doesn't exist - create new vendor group
      cart.vendors.push({
        vendorId: new mongoose.Types.ObjectId(vendorId),
        items: [
          {
            productId: new mongoose.Types.ObjectId(productId),
            name: product.name,
            price: itemPrice,
            quantity,
            total: itemTotal,
          },
        ],
        vendorSubTotal: itemTotal,
      });
    }

    // Recalculate grand total
    cart.grandTotal = cart.vendors.reduce(
      (sum, vendor) => sum + vendor.vendorSubTotal,
      0,
    );

    // Save cart
    await cart.save();

    return res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: {
        cartId: cart._id,
        grandTotal: cart.grandTotal,
        vendorsCount: cart.vendors.length,
      },
    });
  } catch (error) {
    console.error('Error in addToCart:', error);
    return next(error);
  }
}

/**
 * Get cart
 * GET /api/cart
 */
async function getCart(req, res, next) {
  try {
    const userId = req.userId; // From middleware

    // Find cart
    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'vendors.vendorId',
        select: 'shopName ownerName',
      })
      .populate({
        path: 'vendors.items.productId',
        select: 'name price discountPrice mainImage',
      })
      .lean();

    if (!cart) {
      // Return empty cart
      return res.json({
        success: true,
        cart: {
          vendors: [],
          grandTotal: 0,
        },
      });
    }

    // Format response with calculated values
    const formattedVendors = cart.vendors.map((vendor) => {
      const vendorInfo = vendor.vendorId
        ? {
            id: vendor.vendorId._id || vendor.vendorId,
            shopName: vendor.vendorId.shopName,
            ownerName: vendor.vendorId.ownerName,
          }
        : null;

      const formattedItems = vendor.items.map((item) => {
        const product = item.productId;
        // Use stored price from cart (snapshot at add time)
        const itemPrice = item.price;
        const calculatedTotal = itemPrice * item.quantity;

        return {
          productId: item.productId?._id || item.productId,
          name: item.name || product?.name,
          price: itemPrice,
          quantity: item.quantity,
          total: calculatedTotal,
          image: product?.mainImage || null,
        };
      });

      // Recalculate vendor subtotal from items
      const vendorSubTotal = formattedItems.reduce(
        (sum, item) => sum + item.total,
        0,
      );

      return {
        vendor: vendorInfo,
        items: formattedItems,
        vendorSubTotal,
      };
    });

    // Recalculate grand total
    const grandTotal = formattedVendors.reduce(
      (sum, vendor) => sum + vendor.vendorSubTotal,
      0,
    );

    return res.json({
      success: true,
      cart: {
        vendors: formattedVendors,
        grandTotal,
      },
    });
  } catch (error) {
    console.error('Error in getCart:', error);
    return next(error);
  }
}

module.exports = {
  addToCart,
  getCart,
};

