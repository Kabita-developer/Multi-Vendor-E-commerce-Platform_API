const multer = require('multer');

// Configure multer for memory storage (we'll upload directly to S3)
const storage = multer.memoryStorage();

// File filter to accept only image files
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WebP images are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
  },
});

// Middleware for profile picture upload
const uploadProfilePicture = (req, res, next) => {
  upload.single('profilePicture')(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size too large. Maximum size is 5MB.',
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected field. Use "profilePicture" as the field name.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`,
        });
      }
      // Handle other errors (like file type validation)
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }
    
    next();
  });
};

module.exports = {
  uploadProfilePicture,
};

