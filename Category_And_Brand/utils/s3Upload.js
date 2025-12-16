const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

/**
 * Upload file to AWS S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} originalName - Original file name
 * @param {String} folder - Folder path in S3 (e.g., 'brands')
 * @returns {Promise<String>} - S3 URL of uploaded file
 */
async function uploadToS3(fileBuffer, originalName, folder = 'brands') {
  try {
    // Validate AWS configuration
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!bucketName || bucketName === 'your-s3-bucket-name') {
      throw new Error(
        'AWS_S3_BUCKET_NAME environment variable is not set. ' +
        'Please create a .env file in the project root and add your AWS S3 configuration. ' +
        'See env.example for reference.'
      );
    }
    
    if (!accessKeyId || accessKeyId === 'your-aws-access-key-id' || 
        !secretAccessKey || secretAccessKey === 'your-aws-secret-access-key') {
      throw new Error(
        'AWS credentials are not configured. ' +
        'Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file.'
      );
    }
    
    // Generate unique file name
    const fileExtension = path.extname(originalName);
    const fileName = `${folder}/${uuidv4()}${fileExtension}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: getContentType(fileExtension),
      // Note: ACL is deprecated in newer S3 buckets, use bucket policy instead for public access
    });

    await s3Client.send(command);

    // Return S3 URL (format varies by region)
    const region = process.env.AWS_REGION || 'us-east-1';
    let s3Url;
    if (region === 'us-east-1') {
      // us-east-1 uses a different URL format
      s3Url = `https://${bucketName}.s3.amazonaws.com/${fileName}`;
    } else {
      s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
    }
    return s3Url;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
}

/**
 * Get content type based on file extension
 * @param {String} extension - File extension
 * @returns {String} - MIME type
 */
function getContentType(extension) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
  };
  
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Detect file type (image or video) based on extension
 * @param {String} extension - File extension
 * @returns {String} - 'image' or 'video'
 */
function detectFileType(extension) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const videoExtensions = ['.mp4', '.mov', '.webm'];
  
  const ext = extension.toLowerCase();
  
  if (imageExtensions.includes(ext)) {
    return 'image';
  }
  if (videoExtensions.includes(ext)) {
    return 'video';
  }
  
  return 'unknown';
}

module.exports = {
  uploadToS3,
  detectFileType,
};

