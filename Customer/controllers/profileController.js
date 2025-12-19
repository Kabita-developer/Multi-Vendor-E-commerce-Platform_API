const Customer = require('../models/Customer');
const { uploadToS3 } = require('../../Category_And_Brand/utils/s3Upload');
const { resizeImage, getResizedFileName } = require('../../Product/utils/imageResize');

/**
 * Upload customer profile picture
 * POST /api/customer/profile/picture
 */
async function uploadProfilePicture(req, res, next) {
  try {
    const userId = req.userId; // From middleware

    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture file is required. Please send it as form-data field "profilePicture" with a valid image file (JPG, PNG, WebP).',
      });
    }

    // Find customer
    const customer = await Customer.findById(userId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const originalBuffer = req.file.buffer;
    const originalName = req.file.originalname;

    let profilePictureUrls = {};

    try {
      // Upload original size
      const originalUrl = await uploadToS3(originalBuffer, originalName, 'customers/profile-pictures');
      profilePictureUrls.original = originalUrl;

      // Resize and upload 100px version
      const resized100Buffer = await resizeImage(originalBuffer, 100);
      const resized100Name = getResizedFileName(originalName, 100);
      const size100Url = await uploadToS3(resized100Buffer, resized100Name, 'customers/profile-pictures');
      profilePictureUrls.size100 = size100Url;

      // Resize and upload 200px version
      const resized200Buffer = await resizeImage(originalBuffer, 200);
      const resized200Name = getResizedFileName(originalName, 200);
      const size200Url = await uploadToS3(resized200Buffer, resized200Name, 'customers/profile-pictures');
      profilePictureUrls.size200 = size200Url;
    } catch (uploadError) {
      console.error('Error uploading profile picture to S3:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload profile picture to S3',
        error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined,
      });
    }

    // Update customer profile picture
    customer.profilePicture = profilePictureUrls;
    await customer.save();

    return res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePicture: customer.profilePicture,
      },
    });
  } catch (error) {
    console.error('Error in uploadProfilePicture:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload profile picture',
    });
  }
}

/**
 * Get customer profile (including profile picture)
 * GET /api/customer/profile
 */
async function getProfile(req, res, next) {
  try {
    const userId = req.userId; // From middleware

    const customer = await Customer.findById(userId)
      .select('-password -resetToken -resetTokenExpiresAt')
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    return res.json({
      success: true,
      data: {
        customer: {
          id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          role: customer.role,
          address: customer.address,
          profilePicture: customer.profilePicture || null,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch profile',
    });
  }
}

/**
 * Delete customer profile picture
 * DELETE /api/customer/profile/picture
 */
async function deleteProfilePicture(req, res, next) {
  try {
    const userId = req.userId; // From middleware

    const customer = await Customer.findById(userId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Clear profile picture
    customer.profilePicture = undefined;
    await customer.save();

    return res.json({
      success: true,
      message: 'Profile picture deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteProfilePicture:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete profile picture',
    });
  }
}

module.exports = {
  uploadProfilePicture,
  getProfile,
  deleteProfilePicture,
};

