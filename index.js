require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const superAdminRoutes = require('./Super_Admin/routes/authRoutes');
const adminRoutes = require('./Admin/routes/authRoutes');
const vendorRoutes = require('./Vendor/routes/authRoutes');
const passwordRoutes = require('./Auth/routes/passwordRoutes');
const customerRoutes = require('./Customer/routes/authRoutes');
const customerProductRoutes = require('./Customer/routes/productRoutes');
const cartRoutes = require('./Cart_System/routes/cartRoutes');
const wishlistRoutes = require('./Wishlist/routes/wishlistRoutes');
const orderRoutes = require('./Checkout_System/routes/orderRoutes');
const buyNowRoutes = require('./Buy_Now/routes/buyNowRoutes');
const paymentRoutes = require('./Payment_Processing/routes/paymentRoutes');
const commissionRoutes = require('./Commission_Calculation/routes/commissionRoutes');
const walletCreditRoutes = require('./Vendor_Wallet_Credit/routes/walletCreditRoutes');
const orderFulfillmentRoutes = require('./Order_Fulfillment/routes/orderFulfillmentRoutes');
const orderTrackingRoutes = require('./Order_Tracking/routes/trackingRoutes');
const reviewRoutes = require('./Review_Rating/routes/reviewRoutes');
const withdrawalRoutes = require('./Vendor_Withdrawal_Request/routes/withdrawalRoutes');
const settlementRoutes = require('./Admin_Settlement/routes/settlementRoutes');
const dashboardRoutes = require('./Admin_Dashboard/routes/dashboardRoutes');
const vendorDashboardRoutes = require('./Vendor_Dashboard/routes/dashboardRoutes');
const customerSupportRoutes = require('./Customer_Service/routes/customerSupportRoutes');
const adminSupportRoutes = require('./Customer_Service/routes/adminSupportRoutes');
const vendorSupportRoutes = require('./Customer_Service/routes/vendorSupportRoutes');
const customerOrderRoutes = require('./Customer_Order_Cancel_Return_&_Refund_System/routes/customerOrderRoutes');
const adminOrderRoutes = require('./Customer_Order_Cancel_Return_&_Refund_System/routes/adminOrderRoutes');
const searchRoutes = require('./Searching_Algorithms/routes/searchRoutes');
const categoryRoutes = require('./Category_And_Brand/routes/categoryRoutes');
const brandRoutes = require('./Category_And_Brand/routes/brandRoutes');
const adminCategoryRoutes = require('./Category_And_Brand/routes/adminCategoryRoutes');
const adminBrandRoutes = require('./Category_And_Brand/routes/adminBrandRoutes');
const productRoutes = require('./Product/routes/productRoutes');
const couponRoutes = require('./Checkout_System/routes/couponRoutes');
const Vendor = require('./Vendor/models/Vendor');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/multi_vendor';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/vendor/products', productRoutes);
app.use('/api/auth', passwordRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orders', buyNowRoutes);
app.use('/api/orders', orderTrackingRoutes);
app.use('/api', customerOrderRoutes);
app.use('/api/admin', adminOrderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/vendor', withdrawalRoutes);
app.use('/api/vendor', vendorDashboardRoutes);
app.use('/api/support', customerSupportRoutes);
app.use('/api/admin/support', adminSupportRoutes);
app.use('/api/vendor/support', vendorSupportRoutes);
app.use('/api/admin', settlementRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/commission', commissionRoutes);
app.use('/api/wallet-credit', walletCreditRoutes);
app.use('/api/vendor/orders', orderFulfillmentRoutes);
app.use('/api/admin/coupons', couponRoutes);
// Public routes
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/products', customerProductRoutes);

// Admin protected routes
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/brands', adminBrandRoutes);

// Public vendors listing (or use role-protected routes under /api/admin and /api/super-admin)
app.get('/api/vendors', async (_req, res, next) => {
  try {
    const vendors = await Vendor.find().lean();
    return res.json({ vendors });
  } catch (error) {
    return next(error);
  }
});

// Public pending vendors listing
app.get('/api/vendors/pending', async (_req, res, next) => {
  try {
    const vendors = await Vendor.find({ status: 'pending' }).lean();
    return res.json({ vendors });
  } catch (error) {
    return next(error);
  }
});

// Public vendor by id
app.get('/api/vendors/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id).lean();
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    return res.json({ vendor });
  } catch (error) {
    return next(error);
  }
});

// Fallback for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Standardized error response format
  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { error: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
