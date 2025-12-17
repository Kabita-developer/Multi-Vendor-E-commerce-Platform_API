// ElasticSearch connection configuration
let elasticsearchClient = null;
let isElasticsearchAvailable = false;

try {
  const { Client } = require('@elastic/elasticsearch');

  const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  const ELASTICSEARCH_USERNAME = process.env.ELASTICSEARCH_USERNAME;
  const ELASTICSEARCH_PASSWORD = process.env.ELASTICSEARCH_PASSWORD;

  // Create ElasticSearch client
  const clientConfig = {
    node: ELASTICSEARCH_URL,
  };

  // Add authentication if provided
  if (ELASTICSEARCH_USERNAME && ELASTICSEARCH_PASSWORD) {
    clientConfig.auth = {
      username: ELASTICSEARCH_USERNAME,
      password: ELASTICSEARCH_PASSWORD,
    };
  }

  elasticsearchClient = new Client(clientConfig);
  isElasticsearchAvailable = true;
  console.log('ElasticSearch client initialized');
} catch (error) {
  console.warn('ElasticSearch not available:', error.message);
  console.warn('Search will fallback to MongoDB only');
  isElasticsearchAvailable = false;
}

// Test connection
async function testConnection() {
  if (!isElasticsearchAvailable || !elasticsearchClient) {
    return false;
  }

  try {
    const health = await elasticsearchClient.cluster.health();
    console.log('ElasticSearch connected:', health.status);
    return true;
  } catch (error) {
    console.error('ElasticSearch connection error:', error.message);
    return false;
  }
}

// Index name
const PRODUCTS_INDEX = 'products_index';

module.exports = {
  elasticsearchClient,
  testConnection,
  PRODUCTS_INDEX,
  isElasticsearchAvailable,
};

