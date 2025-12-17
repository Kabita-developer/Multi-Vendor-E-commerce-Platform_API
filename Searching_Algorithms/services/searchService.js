const { elasticsearchClient, PRODUCTS_INDEX, isElasticsearchAvailable } = require('../config/elasticsearch');
const Product = require('../../Product/models/Product');
const mongoose = require('mongoose');
const { expandQueryWithSynonyms } = require('../utils/synonymMapper');

/**
 * Build ElasticSearch query with filters and sorting
 * @param {Object} params - Search parameters
 * @param {String} params.query - Search query string
 * @param {Number} params.minPrice - Minimum price filter
 * @param {Number} params.maxPrice - Maximum price filter
 * @param {String} params.categoryId - Category filter
 * @param {String} params.brandId - Brand filter
 * @param {String} params.vendorId - Vendor filter
 * @param {String} params.sort - Sort option (price_asc, price_desc, rating_desc, newest)
 * @param {Number} params.page - Page number
 * @param {Number} params.limit - Results per page
 */
function buildElasticsearchQuery(params) {
  const {
    query,
    minPrice,
    maxPrice,
    categoryId,
    brandId,
    vendorId,
    sort = 'rating_desc',
    page = 1,
    limit = 20,
  } = params;

  const esQuery = {
    index: PRODUCTS_INDEX,
    body: {
      query: {
        bool: {
          must: [],
          filter: [
            { term: { isActive: true } }, // Only active products
            { range: { stock: { gt: 0 } } }, // Only in-stock products
          ],
        },
      },
      size: limit,
      from: (page - 1) * limit,
    },
  };

  // Add search query with fuzzy matching
  if (query && query.trim()) {
    esQuery.body.query.bool.must.push({
      multi_match: {
        query: query.trim(),
        fields: ['name^3', 'description^1'], // name has higher boost
        type: 'best_fields',
        fuzziness: 'AUTO',
        operator: 'or',
      },
    });
  } else {
    // If no query, match all active products
    esQuery.body.query.bool.must.push({ match_all: {} });
  }

  // Price range filter
  const priceFilter = {};
  if (minPrice !== undefined && minPrice !== null) {
    priceFilter.gte = parseFloat(minPrice);
  }
  if (maxPrice !== undefined && maxPrice !== null) {
    priceFilter.lte = parseFloat(maxPrice);
  }
  if (Object.keys(priceFilter).length > 0) {
    // Use discountPrice if available, else price
    esQuery.body.query.bool.filter.push({
      bool: {
        should: [
          {
            bool: {
              must: [
                { exists: { field: 'discountPrice' } },
                { range: { discountPrice: priceFilter } },
              ],
            },
          },
          {
            bool: {
              must: [
                { bool: { must_not: { exists: { field: 'discountPrice' } } } },
                { range: { price: priceFilter } },
              ],
            },
          },
        ],
      },
    });
  }

  // Category filter
  if (categoryId) {
    esQuery.body.query.bool.filter.push({
      term: { categoryId: categoryId.toString() },
    });
  }

  // Brand filter
  if (brandId) {
    esQuery.body.query.bool.filter.push({
      term: { brandId: brandId.toString() },
    });
  }

  // Vendor filter
  if (vendorId) {
    esQuery.body.query.bool.filter.push({
      term: { vendorId: vendorId.toString() },
    });
  }

  // Sorting
  const sortArray = [];
  switch (sort) {
    case 'price_asc':
      sortArray.push({ discountPrice: { order: 'asc', missing: '_last' } });
      sortArray.push({ price: { order: 'asc' } });
      break;
    case 'price_desc':
      sortArray.push({ discountPrice: { order: 'desc', missing: '_last' } });
      sortArray.push({ price: { order: 'desc' } });
      break;
    case 'rating_desc':
      sortArray.push({ rating: { order: 'desc' } });
      sortArray.push({ reviewCount: { order: 'desc' } });
      break;
    case 'newest':
      sortArray.push({ createdAt: { order: 'desc' } });
      break;
    default:
      // Default: relevance (score) + rating
      sortArray.push({ _score: { order: 'desc' } });
      sortArray.push({ rating: { order: 'desc' } });
  }
  esQuery.body.sort = sortArray;

  return esQuery;
}

/**
 * Search products using ElasticSearch
 * @param {Object} params - Search parameters
 * @returns {Object} Search results
 */
async function searchProducts(params) {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    throw new Error('ElasticSearch is not available');
  }

  try {
    const {
      query,
      minPrice,
      maxPrice,
      categoryId,
      brandId,
      vendorId,
      sort,
      page = 1,
      limit = 20,
    } = params;

    // Validate limit (max 100)
    const validLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);

    // Build ElasticSearch query
    const esQuery = buildElasticsearchQuery({
      query,
      minPrice,
      maxPrice,
      categoryId,
      brandId,
      vendorId,
      sort,
      page: validPage,
      limit: validLimit,
    });

    // Execute search with timeout
    const searchResponse = await elasticsearchClient.search(esQuery, {
      requestTimeout: 10000, // 10 seconds timeout
    });

    // Extract results
    const hits = searchResponse.body.hits;
    const total = hits.total.value || hits.total || 0;
    const products = hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source,
      score: hit._score,
    }));

    return {
      success: true,
      total,
      page: validPage,
      limit: validLimit,
      totalPages: Math.ceil(total / validLimit),
      products,
    };
  } catch (error) {
    console.error('ElasticSearch search error:', error);
    throw error;
  }
}

/**
 * Fallback search using MongoDB (when ElasticSearch fails)
 * @param {Object} params - Search parameters
 * @returns {Object} Search results
 */
async function fallbackMongoDBSearch(params) {
  try {
    const {
      query,
      minPrice,
      maxPrice,
      categoryId,
      brandId,
      vendorId,
      sort,
      page = 1,
      limit = 20,
    } = params;

    const validLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const skip = (validPage - 1) * validLimit;

    // Build MongoDB query
    const mongoQuery = { isActive: true, stock: { $gt: 0 } };

    // Build conditions array for $and
    const conditions = [];

    // Text search - use $or for name OR description with synonym expansion
    if (query && query.trim()) {
      // Expand query with synonyms (Bengali -> English, etc.)
      const searchTerms = expandQueryWithSynonyms(query);
      
      // Build regex patterns for all terms
      const nameConditions = searchTerms.map(term => ({
        name: { $regex: term, $options: 'i' },
      }));
      
      const descriptionConditions = searchTerms.map(term => ({
        description: { $regex: term, $options: 'i' },
      }));

      // Combine all conditions with $or
      conditions.push({
        $or: [
          ...nameConditions,
          ...descriptionConditions,
        ],
      });
    }

    // Price filter
    const priceFilter = {};
    if (minPrice !== undefined && minPrice !== null) {
      priceFilter.$gte = parseFloat(minPrice);
    }
    if (maxPrice !== undefined && maxPrice !== null) {
      priceFilter.$lte = parseFloat(maxPrice);
    }
    if (Object.keys(priceFilter).length > 0) {
      // Match products where discountPrice is in range OR (discountPrice doesn't exist AND price is in range)
      conditions.push({
        $or: [
          { discountPrice: priceFilter },
          {
            $and: [
              { $or: [{ discountPrice: { $exists: false } }, { discountPrice: null }] },
              { price: priceFilter },
            ],
          },
        ],
      });
    }

    // If we have conditions, combine them with $and
    if (conditions.length > 0) {
      mongoQuery.$and = conditions;
    }

    // Category filter
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      mongoQuery.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    // Brand filter
    if (brandId && mongoose.Types.ObjectId.isValid(brandId)) {
      mongoQuery.brandId = new mongoose.Types.ObjectId(brandId);
    }

    // Vendor filter
    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      mongoQuery.vendorId = new mongoose.Types.ObjectId(vendorId);
    }

    // Build sort
    let sortOption = {};
    switch (sort) {
      case 'price_asc':
        sortOption = { discountPrice: 1, price: 1 };
        break;
      case 'price_desc':
        sortOption = { discountPrice: -1, price: -1 };
        break;
      case 'rating_desc':
        sortOption = { rating: -1, reviewCount: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      default:
        sortOption = { rating: -1, reviewCount: -1 };
    }

    // Execute MongoDB query
    const [products, total] = await Promise.all([
      Product.find(mongoQuery)
        .select('name description price discountPrice categoryId brandId vendorId rating reviewCount stock slug mainImage')
        .sort(sortOption)
        .skip(skip)
        .limit(validLimit)
        .lean(),
      Product.countDocuments(mongoQuery),
    ]);

    // Format products
    const formattedProducts = products.map((product) => ({
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      price: product.price,
      discountPrice: product.discountPrice,
      categoryId: product.categoryId?.toString(),
      brandId: product.brandId?.toString(),
      vendorId: product.vendorId?.toString(),
      rating: product.rating,
      reviewCount: product.reviewCount,
      stock: product.stock,
      slug: product.slug,
      mainImage: product.mainImage,
    }));

    return {
      success: true,
      total,
      page: validPage,
      limit: validLimit,
      totalPages: Math.ceil(total / validLimit),
      products: formattedProducts,
      fallback: true, // Indicate this is a fallback result
    };
  } catch (error) {
    console.error('MongoDB fallback search error:', error);
    throw error;
  }
}

/**
 * Search products with ElasticSearch fallback to MongoDB
 * @param {Object} params - Search parameters
 * @returns {Object} Search results
 */
async function searchProductsWithFallback(params) {
  const { isElasticsearchAvailable } = require('../config/elasticsearch');
  
  // If ElasticSearch is not available, go directly to MongoDB
  if (!isElasticsearchAvailable) {
    return await fallbackMongoDBSearch(params);
  }

  try {
    // Try ElasticSearch first
    return await searchProducts(params);
  } catch (error) {
    console.warn('ElasticSearch search failed, falling back to MongoDB:', error.message);
    // Fallback to MongoDB
    return await fallbackMongoDBSearch(params);
  }
}

module.exports = {
  searchProducts,
  fallbackMongoDBSearch,
  searchProductsWithFallback,
  buildElasticsearchQuery,
};

