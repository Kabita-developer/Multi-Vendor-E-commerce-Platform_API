const express = require('express');
const {
  signup,
  login,
  logout,
  updateVendor,
  deleteVendor,
} = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
// Support both URL param and body-provided id
router.post('/update/:id', updateVendor);
router.post('/update', updateVendor);
router.post('/delete', deleteVendor);

module.exports = router;

