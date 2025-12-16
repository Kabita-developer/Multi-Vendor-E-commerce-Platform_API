const sharp = require('sharp');
const path = require('path');

/**
 * Resize image to specified width while maintaining aspect ratio
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Number} width - Target width in pixels
 * @returns {Promise<Buffer>} - Resized image buffer
 */
async function resizeImage(imageBuffer, width) {
  try {
    const resizedBuffer = await sharp(imageBuffer)
      .resize(width, null, {
        withoutEnlargement: true, // Don't enlarge if image is smaller than target
        fit: 'inside', // Maintain aspect ratio
      })
      .toBuffer();
    
    return resizedBuffer;
  } catch (error) {
    console.error(`Error resizing image to ${width}px:`, error);
    throw new Error(`Failed to resize image to ${width}px: ${error.message}`);
  }
}

/**
 * Generate resized image filename
 * @param {String} originalName - Original filename
 * @param {Number} width - Target width
 * @returns {String} - Resized filename
 */
function getResizedFileName(originalName, width) {
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext);
  return `${nameWithoutExt}_${width}px${ext}`;
}

module.exports = {
  resizeImage,
  getResizedFileName,
};

