const { elasticsearchClient, PRODUCTS_INDEX, isElasticsearchAvailable } = require('../config/elasticsearch');

/**
 * Create ElasticSearch index with mapping and settings
 */
async function createIndex() {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    throw new Error('ElasticSearch is not available');
  }

  try {
    // Check if index exists
    const indexExists = await elasticsearchClient.indices.exists({
      index: PRODUCTS_INDEX,
    });

    if (indexExists) {
      console.log(`Index ${PRODUCTS_INDEX} already exists`);
      return { success: true, message: 'Index already exists' };
    }

    // Create index with mapping
    const indexMapping = {
      index: PRODUCTS_INDEX,
      body: {
        settings: {
          analysis: {
            filter: {
              synonym_filter: {
                type: 'synonym',
                synonyms: [
                  'fan, পাখা, ventilator, ceiling fan',
                  'rice, চাল, chawal',
                  'oil, তেল, cooking oil',
                  'shoes, জুতো, footwear',
                  'phone, মোবাইল, mobile, smartphone',
                  'laptop, ল্যাপটপ, notebook',
                  'tv, টিভি, television',
                  'fridge, রেফ্রিজারেটর, refrigerator',
                  'washing machine, ওয়াশিং মেশিন, washer',
                  'ac, এসি, air conditioner, cooler',
                ],
              },
            },
            analyzer: {
              synonym_analyzer: {
                tokenizer: 'standard',
                filter: ['lowercase', 'synonym_filter'],
              },
            },
          },
        },
        mappings: {
          properties: {
            name: {
              type: 'text',
              analyzer: 'synonym_analyzer',
              fields: {
                keyword: {
                  type: 'keyword',
                },
              },
            },
            description: {
              type: 'text',
              analyzer: 'synonym_analyzer',
            },
            price: {
              type: 'float',
            },
            discountPrice: {
              type: 'float',
            },
            categoryId: {
              type: 'keyword',
            },
            subCategoryId: {
              type: 'keyword',
            },
            brandId: {
              type: 'keyword',
            },
            vendorId: {
              type: 'keyword',
            },
            rating: {
              type: 'float',
            },
            reviewCount: {
              type: 'integer',
            },
            stock: {
              type: 'integer',
            },
            isActive: {
              type: 'boolean',
            },
            slug: {
              type: 'keyword',
            },
            mainImage: {
              type: 'object',
              properties: {
                original: { type: 'keyword' },
                size100: { type: 'keyword' },
                size200: { type: 'keyword' },
              },
            },
            createdAt: {
              type: 'date',
            },
            updatedAt: {
              type: 'date',
            },
          },
        },
      },
    };

    await elasticsearchClient.indices.create(indexMapping);
    console.log(`Index ${PRODUCTS_INDEX} created successfully`);

    return { success: true, message: 'Index created successfully' };
  } catch (error) {
    console.error('Error creating ElasticSearch index:', error);
    throw error;
  }
}

/**
 * Delete ElasticSearch index
 */
async function deleteIndex() {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    throw new Error('ElasticSearch is not available');
  }

  try {
    const indexExists = await elasticsearchClient.indices.exists({
      index: PRODUCTS_INDEX,
    });

    if (!indexExists) {
      return { success: true, message: 'Index does not exist' };
    }

    await elasticsearchClient.indices.delete({
      index: PRODUCTS_INDEX,
    });

    console.log(`Index ${PRODUCTS_INDEX} deleted successfully`);
    return { success: true, message: 'Index deleted successfully' };
  } catch (error) {
    console.error('Error deleting ElasticSearch index:', error);
    throw error;
  }
}

/**
 * Update index settings (e.g., synonyms)
 */
async function updateIndexSettings() {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    throw new Error('ElasticSearch is not available');
  }

  try {
    // Close index
    await elasticsearchClient.indices.close({ index: PRODUCTS_INDEX });

    // Update settings
    await elasticsearchClient.indices.putSettings({
      index: PRODUCTS_INDEX,
      body: {
        analysis: {
          filter: {
            synonym_filter: {
              type: 'synonym',
              synonyms: [
                'fan, পাখা, ventilator, ceiling fan',
                'rice, চাল, chawal',
                'oil, তেল, cooking oil',
                'shoes, জুতো, footwear',
                'phone, মোবাইল, mobile, smartphone',
                'laptop, ল্যাপটপ, notebook',
                'tv, টিভি, television',
                'fridge, রেফ্রিজারেটর, refrigerator',
                'washing machine, ওয়াশিং মেশিন, washer',
                'ac, এসি, air conditioner, cooler',
              ],
            },
          },
          analyzer: {
            synonym_analyzer: {
              tokenizer: 'standard',
              filter: ['lowercase', 'synonym_filter'],
            },
          },
        },
      },
    });

    // Reopen index
    await elasticsearchClient.indices.open({ index: PRODUCTS_INDEX });

    console.log(`Index ${PRODUCTS_INDEX} settings updated successfully`);
    return { success: true, message: 'Index settings updated successfully' };
  } catch (error) {
    console.error('Error updating ElasticSearch index settings:', error);
    throw error;
  }
}

module.exports = {
  createIndex,
  deleteIndex,
  updateIndexSettings,
};

