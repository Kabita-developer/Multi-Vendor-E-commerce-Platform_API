const { elasticsearchClient, PRODUCTS_INDEX, isElasticsearchAvailable } = require('../config/elasticsearch');
const Product = require('../../Product/models/Product');

/**
 * Convert MongoDB product document to ElasticSearch document format
 */
function formatProductForElasticsearch(product) {
  return {
    id: product._id.toString(),
    name: product.name || '',
    description: product.description || '',
    price: product.price || 0,
    discountPrice: product.discountPrice || null,
    categoryId: product.categoryId?.toString() || null,
    subCategoryId: product.subCategoryId || null,
    brandId: product.brandId?.toString() || null,
    vendorId: product.vendorId?.toString() || null,
    rating: product.rating || 0,
    reviewCount: product.reviewCount || 0,
    stock: product.stock || 0,
    isActive: product.isActive !== false, // Default to true
    slug: product.slug || '',
    mainImage: product.mainImage || null,
    createdAt: product.createdAt || new Date(),
    updatedAt: product.updatedAt || new Date(),
  };
}

/**
 * Index a single product into ElasticSearch
 * @param {Object} product - MongoDB product document
 */
async function indexProduct(product) {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    throw new Error('ElasticSearch is not available');
  }

  try {
    if (!product || !product._id) {
      throw new Error('Invalid product data');
    }

    const productDoc = formatProductForElasticsearch(product);

    await elasticsearchClient.index({
      index: PRODUCTS_INDEX,
      id: productDoc.id,
      body: productDoc,
    });

    console.log(`Product ${productDoc.id} indexed successfully`);
    return { success: true, productId: productDoc.id };
  } catch (error) {
    console.error(`Error indexing product ${product._id}:`, error.message);
    throw error;
  }
}

/**
 * Update a product in ElasticSearch
 * @param {Object} product - MongoDB product document
 */
async function updateProductInIndex(product) {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    throw new Error('ElasticSearch is not available');
  }

  try {
    if (!product || !product._id) {
      throw new Error('Invalid product data');
    }

    const productDoc = formatProductForElasticsearch(product);

    await elasticsearchClient.update({
      index: PRODUCTS_INDEX,
      id: productDoc.id,
      body: {
        doc: productDoc,
      },
    });

    console.log(`Product ${productDoc.id} updated in index`);
    return { success: true, productId: productDoc.id };
  } catch (error) {
    // If document doesn't exist, index it
    if (error.meta?.statusCode === 404) {
      return await indexProduct(product);
    }
    console.error(`Error updating product ${product._id} in index:`, error.message);
    throw error;
  }
}

/**
 * Remove a product from ElasticSearch
 * @param {String} productId - Product ID
 */
async function removeProductFromIndex(productId) {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    throw new Error('ElasticSearch is not available');
  }

  try {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    await elasticsearchClient.delete({
      index: PRODUCTS_INDEX,
      id: productId.toString(),
    });

    console.log(`Product ${productId} removed from index`);
    return { success: true, productId };
  } catch (error) {
    // If document doesn't exist, that's okay
    if (error.meta?.statusCode === 404) {
      console.log(`Product ${productId} not found in index (already deleted)`);
      return { success: true, productId, message: 'Product not found in index' };
    }
    console.error(`Error removing product ${productId} from index:`, error.message);
    throw error;
  }
}

/**
 * Bulk index products (for initial sync)
 * @param {Array} products - Array of MongoDB product documents
 */
async function bulkIndexProducts(products) {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    throw new Error('ElasticSearch is not available');
  }

  try {
    if (!products || products.length === 0) {
      return { success: true, indexed: 0 };
    }

    const body = [];
    for (const product of products) {
      const productDoc = formatProductForElasticsearch(product);
      body.push({ index: { _index: PRODUCTS_INDEX, _id: productDoc.id } });
      body.push(productDoc);
    }

    const response = await elasticsearchClient.bulk({ body });

    if (response.errors) {
      const erroredDocuments = [];
      response.items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            product: products[i],
          });
        }
      });
      console.error('Bulk index errors:', erroredDocuments);
    }

    const indexed = response.items.filter((item) => !item.index.error).length;
    console.log(`Bulk indexed ${indexed} products`);

    return { success: true, indexed, total: products.length };
  } catch (error) {
    console.error('Error in bulk indexing:', error);
    throw error;
  }
}

/**
 * Sync all active products from MongoDB to ElasticSearch
 */
async function syncAllProducts() {
  try {
    console.log('Starting full product sync to ElasticSearch...');

    // Fetch all active products
    const products = await Product.find({ isActive: true }).lean();

    if (products.length === 0) {
      console.log('No active products to sync');
      return { success: true, indexed: 0 };
    }

    const result = await bulkIndexProducts(products);
    console.log(`Full sync completed: ${result.indexed} products indexed`);

    return result;
  } catch (error) {
    console.error('Error in full product sync:', error);
    throw error;
  }
}

module.exports = {
  indexProduct,
  updateProductInIndex,
  removeProductFromIndex,
  bulkIndexProducts,
  syncAllProducts,
  formatProductForElasticsearch,
};

