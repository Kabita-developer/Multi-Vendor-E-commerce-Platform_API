const syncService = require('../services/syncService');
const indexService = require('../services/indexService');

/**
 * Sync all products to ElasticSearch
 * POST /api/search/sync
 * Access: Admin/Super Admin only (optional - can be made public for initial setup)
 */
async function syncAllProducts(req, res, next) {
  try {
    const result = await syncService.syncAllProducts();

    return res.json({
      success: true,
      message: 'Product sync completed',
      ...result,
    });
  } catch (error) {
    console.error('Error in syncAllProducts:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync products',
    });
  }
}

/**
 * Create ElasticSearch index
 * POST /api/search/index/create
 * Access: Admin/Super Admin only (optional)
 */
async function createIndex(req, res, next) {
  try {
    const result = await indexService.createIndex();

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error in createIndex:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create index',
    });
  }
}

/**
 * Update index settings (synonyms)
 * POST /api/search/index/update-settings
 * Access: Admin/Super Admin only (optional)
 */
async function updateIndexSettings(req, res, next) {
  try {
    const result = await indexService.updateIndexSettings();

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error in updateIndexSettings:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update index settings',
    });
  }
}

module.exports = {
  syncAllProducts,
  createIndex,
  updateIndexSettings,
};

