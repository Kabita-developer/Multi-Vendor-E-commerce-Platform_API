const searchService = require('../services/searchService');

/**
 * Search products
 * GET /api/products/search
 */
async function searchProducts(req, res, next) {
  try {
    const {
      q: query,
      minPrice,
      maxPrice,
      categoryId,
      brandId,
      vendorId,
      sort,
      page,
      limit,
    } = req.query;

    // Build search parameters
    const searchParams = {
      query: query || '',
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      categoryId,
      brandId,
      vendorId,
      sort: sort || 'rating_desc',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    };

    // Execute search with fallback
    const results = await searchService.searchProductsWithFallback(searchParams);

    // Log search query for debugging (in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('Search query:', searchParams.query);
      console.log('Results found:', results.total);
    }

    return res.json({
      success: true,
      query: query || '',
      total: results.total,
      page: results.page,
      limit: results.limit,
      totalPages: results.totalPages,
      results: results.products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        discountPrice: product.discountPrice,
        categoryId: product.categoryId,
        brandId: product.brandId,
        vendorId: product.vendorId,
        rating: product.rating,
        reviewCount: product.reviewCount,
        stock: product.stock,
        slug: product.slug,
        mainImage: product.mainImage,
        score: product.score, // ElasticSearch relevance score (if available)
      })),
      fallback: results.fallback || false, // Indicate if MongoDB fallback was used
    });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Search failed',
      ...(process.env.NODE_ENV === 'development' && { error: error.stack }),
    });
  }
}

/**
 * Health check for ElasticSearch
 * GET /api/search/health
 */
async function searchHealth(req, res, next) {
  try {
    const { testConnection } = require('../config/elasticsearch');
    const isConnected = await testConnection();

    return res.json({
      success: isConnected,
      elasticsearch: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      elasticsearch: 'error',
      message: error.message,
    });
  }
}

module.exports = {
  searchProducts,
  searchHealth,
};

