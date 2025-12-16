const express = require('express');
const {
  signup,
  login,
  logout,
  approveVendor,
  rejectVendor,
  listVendors,
  listPendingVendors,
  getVendorById,
  getAllVendorProducts,
} = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.post('/vendors/:id/approve', approveVendor);
router.post('/vendors/:id/reject', rejectVendor);
router.get('/vendors', listVendors);
router.get('/vendors/pending', listPendingVendors);
router.get('/vendors/:id', getVendorById);
router.get('/products', getAllVendorProducts);

module.exports = router;

