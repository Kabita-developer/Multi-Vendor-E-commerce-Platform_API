const express = require('express');
const { register, login, logout } = require('../controllers/authController');
const { uploadProfilePicture, getProfile, deleteProfilePicture } = require('../controllers/profileController');
const { authenticateCustomer } = require('../../Cart_System/middleware/customerMiddleware');
const { uploadProfilePicture: uploadMiddleware } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Profile routes (authenticated)
router.get('/profile', authenticateCustomer, getProfile);
router.post('/profile/picture', authenticateCustomer, uploadMiddleware, uploadProfilePicture);
router.delete('/profile/picture', authenticateCustomer, deleteProfilePicture);

module.exports = router;

