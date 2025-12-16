const multer = require('multer');
const path = require('path');

// Configure multer for memory storage (we'll upload directly to S3)
const storage = multer.memoryStorage();

// File filter to accept only image and video files
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    // Videos
    'video/mp4',
    'video/quicktime', // .mov
    'video/webm',
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, WebP images and MP4, MOV, WebM videos are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (for videos)
  },
});

// Middleware for product uploads: mainImage (required) + media (optional, multiple)
const uploadProductFiles = (req, res, next) => {
  const fields = [
    { name: 'mainImage', maxCount: 1 },
    { name: 'media', maxCount: 20 }, // Allow up to 20 media files
  ];
  
  upload.fields(fields)(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size too large. Maximum size is 50MB per file.',
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Too many files. Maximum 20 media files allowed.',
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected field. Use "mainImage" for the main image and "media" (without brackets) for additional files.',
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

// Middleware for optional product uploads (used in update API)
// - mainImage and media are optional
const uploadOptionalProductFiles = (req, res, next) => {
  const fields = [
    { name: 'mainImage', maxCount: 1 },
    { name: 'media', maxCount: 20 },
  ];

  upload.fields(fields)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size too large. Maximum size is 50MB per file.',
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Too many files. Maximum 20 media files allowed.',
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected field. Use "mainImage" for the main image and "media" (without brackets) for additional files.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`,
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }

    next();
  });
};

module.exports = {
  uploadProductFiles,
  uploadOptionalProductFiles,
};

