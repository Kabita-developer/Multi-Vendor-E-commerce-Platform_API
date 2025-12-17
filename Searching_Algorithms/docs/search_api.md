# Smart Product Search API Documentation

## Overview

This document describes the ElasticSearch-powered Smart Product Search system for the Multi-Vendor E-commerce Platform. The system supports intelligent search with Bengali/English mixed language support, synonyms, fuzzy matching, and relevance ranking.

**Base URL:** `/api/search`

**Architecture:** MongoDB (Products) → ElasticSearch Index → Search API → Client

---

## Features

### 1. Multi-Language Support
- Bengali and English search
- Mixed language queries (e.g., "পাখা কম দামে" → "fan low price")
- Synonym support for common terms

### 2. Intelligent Search
- **Fuzzy Matching:** Handles typos automatically
- **Synonym Matching:** Maps related terms (e.g., "fan" = "পাখা" = "ventilator")
- **Relevance Ranking:** Combines search score with popularity (rating, reviews)

### 3. Advanced Filtering
- Price range filtering
- Category, Brand, Vendor filters
- Active products only
- In-stock products only

### 4. Sorting Options
- Price (ascending/descending)
- Rating (descending)
- Newest
- Relevance (default)

### 5. Fallback Mechanism
- Automatic fallback to MongoDB if ElasticSearch fails
- Ensures search is always available

---

## ElasticSearch Index

### Index Name
`products_index`

### Index Mapping

```json
{
  "settings": {
    "analysis": {
      "filter": {
        "synonym_filter": {
          "type": "synonym",
          "synonyms": [
            "fan, পাখা, ventilator, ceiling fan",
            "rice, চাল, chawal",
            "oil, তেল, cooking oil",
            "shoes, জুতো, footwear",
            "phone, মোবাইল, mobile, smartphone",
            "laptop, ল্যাপটপ, notebook",
            "tv, টিভি, television",
            "fridge, রেফ্রিজারেটর, refrigerator",
            "washing machine, ওয়াশিং মেশিন, washer",
            "ac, এসি, air conditioner, cooler"
          ]
        }
      },
      "analyzer": {
        "synonym_analyzer": {
          "tokenizer": "standard",
          "filter": ["lowercase", "synonym_filter"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "synonym_analyzer",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "synonym_analyzer"
      },
      "price": { "type": "float" },
      "discountPrice": { "type": "float" },
      "categoryId": { "type": "keyword" },
      "subCategoryId": { "type": "keyword" },
      "brandId": { "type": "keyword" },
      "vendorId": { "type": "keyword" },
      "rating": { "type": "float" },
      "reviewCount": { "type": "integer" },
      "stock": { "type": "integer" },
      "isActive": { "type": "boolean" },
      "slug": { "type": "keyword" },
      "mainImage": {
        "type": "object",
        "properties": {
          "original": { "type": "keyword" },
          "size100": { "type": "keyword" },
          "size200": { "type": "keyword" }
        }
      },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" }
    }
  }
}
```

---

## API Endpoints

### 1. Search Products

**Endpoint:** `GET /api/search/search`

**Access:** Public (no authentication required)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | String | No | Search query (Bengali/English/Mixed) |
| `minPrice` | Number | No | Minimum price filter |
| `maxPrice` | Number | No | Maximum price filter |
| `categoryId` | String | No | Filter by category ID |
| `brandId` | String | No | Filter by brand ID |
| `vendorId` | String | No | Filter by vendor ID |
| `sort` | String | No | Sort option: `price_asc`, `price_desc`, `rating_desc`, `newest` (default: `rating_desc`) |
| `page` | Number | No | Page number (default: 1) |
| `limit` | Number | No | Results per page (default: 20, max: 100) |

**Request Example:**

```bash
# Bengali search
GET /api/search/search?q=পাখা&minPrice=500&maxPrice=3000&sort=price_asc

# English search
GET /api/search/search?q=ceiling fan&sort=rating_desc

# Mixed language
GET /api/search/search?q=সিলিং পাখা কম দামে&minPrice=1000&maxPrice=5000

# With filters
GET /api/search/search?q=phone&categoryId=CATEGORY_ID&brandId=BRAND_ID&page=1&limit=20
```

**Success Response:**

```json
{
  "success": true,
  "query": "পাখা",
  "total": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3,
  "results": [
    {
      "id": "PRODUCT_ID",
      "name": "Havells Ceiling Fan",
      "description": "Energy efficient ceiling fan with remote control",
      "price": 1999,
      "discountPrice": 1799,
      "categoryId": "CATEGORY_ID",
      "brandId": "BRAND_ID",
      "vendorId": "VENDOR_ID",
      "rating": 4.6,
      "reviewCount": 120,
      "stock": 50,
      "slug": "havells-ceiling-fan",
      "mainImage": {
        "original": "https://...",
        "size100": "https://...",
        "size200": "https://..."
      },
      "score": 8.5
    }
  ],
  "fallback": false
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `query` | String | The search query used |
| `total` | Number | Total number of matching products |
| `page` | Number | Current page number |
| `limit` | Number | Results per page |
| `totalPages` | Number | Total number of pages |
| `results` | Array | Array of product objects |
| `results[].id` | String | Product ID |
| `results[].name` | String | Product name |
| `results[].description` | String | Product description |
| `results[].price` | Number | Regular price |
| `results[].discountPrice` | Number | Discounted price (if available) |
| `results[].rating` | Number | Average rating (0-5) |
| `results[].reviewCount` | Number | Number of reviews |
| `results[].stock` | Number | Available stock |
| `results[].score` | Number | ElasticSearch relevance score (if available) |
| `fallback` | Boolean | `true` if MongoDB fallback was used |

**Error Response:**

```json
{
  "success": false,
  "message": "Search failed"
}
```

---

### 2. Search Health Check

**Endpoint:** `GET /api/search/health`

**Access:** Public

**Purpose:** Check ElasticSearch connection status

**Success Response:**

```json
{
  "success": true,
  "elasticsearch": "connected",
  "timestamp": "2025-01-10T10:00:00.000Z"
}
```

**Error Response:**

```json
{
  "success": false,
  "elasticsearch": "disconnected",
  "timestamp": "2025-01-10T10:00:00.000Z"
}
```

---

### 3. Sync All Products

**Endpoint:** `POST /api/search/sync`

**Access:** Admin/Super Admin (optional - can be made public for initial setup)

**Purpose:** Sync all active products from MongoDB to ElasticSearch

**Success Response:**

```json
{
  "success": true,
  "message": "Product sync completed",
  "indexed": 1250,
  "total": 1250
}
```

---

### 4. Create Index

**Endpoint:** `POST /api/search/index/create`

**Access:** Admin/Super Admin (optional)

**Purpose:** Create ElasticSearch index with mapping and settings

**Success Response:**

```json
{
  "success": true,
  "message": "Index created successfully"
}
```

---

### 5. Update Index Settings

**Endpoint:** `POST /api/search/index/update-settings`

**Access:** Admin/Super Admin (optional)

**Purpose:** Update index settings (e.g., synonyms)

**Success Response:**

```json
{
  "success": true,
  "message": "Index settings updated successfully"
}
```

---

## Data Sync Logic

### Automatic Sync

Products are automatically synced to ElasticSearch when:
- **Product Created:** Indexed immediately
- **Product Updated:** Updated in index
- **Product Deleted:** Removed from index (soft delete: `isActive = false`)

### Sync Implementation

Sync operations are **non-blocking** - they don't slow down API responses:
- Sync happens asynchronously after product operations
- Errors are logged but don't affect the main operation
- If ElasticSearch is unavailable, operations continue normally

### Manual Sync

Use the sync endpoint to manually sync all products:
```bash
POST /api/search/sync
```

---

## Search Query Logic

### ElasticSearch Query Structure

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "fan",
            "fields": ["name^3", "description^1"],
            "type": "best_fields",
            "fuzziness": "AUTO",
            "operator": "or"
          }
        }
      ],
      "filter": [
        { "term": { "isActive": true } },
        { "range": { "stock": { "gt": 0 } } },
        { "range": { "price": { "gte": 500, "lte": 3000 } } }
      ]
    }
  },
  "sort": [
    { "rating": { "order": "desc" } },
    { "reviewCount": { "order": "desc" } }
  ]
}
```

### Search Features

1. **Multi-Match Query:**
   - Searches in `name` (boost: 3x) and `description` (boost: 1x)
   - Uses `best_fields` type for relevance
   - Fuzzy matching with `AUTO` fuzziness

2. **Filters:**
   - Only active products (`isActive: true`)
   - Only in-stock products (`stock > 0`)
   - Price range (uses `discountPrice` if available, else `price`)

3. **Sorting:**
   - Default: Relevance score + rating
   - Options: Price (asc/desc), Rating (desc), Newest

---

## Synonym Examples

| English | Bengali | Synonyms |
|---------|---------|----------|
| fan | পাখা | ventilator, ceiling fan |
| rice | চাল | chawal |
| oil | তেল | cooking oil |
| shoes | জুতো | footwear |
| phone | মোবাইল | mobile, smartphone |
| laptop | ল্যাপটপ | notebook |
| tv | টিভি | television |
| fridge | রেফ্রিজারেটর | refrigerator |

**Usage:**
- Searching "পাখা" will match products with "fan", "ventilator", "ceiling fan"
- Searching "fan" will match products with "পাখা", "ventilator", "ceiling fan"

---

## Fallback Mechanism

### MongoDB Fallback

If ElasticSearch fails or is unavailable:
1. Search automatically falls back to MongoDB
2. Uses regex-based text search
3. Applies same filters and sorting
4. Response includes `fallback: true` flag

### Fallback Query

```javascript
// MongoDB query (simplified)
{
  isActive: true,
  stock: { $gt: 0 },
  $or: [
    { name: { $regex: "query", $options: "i" } },
    { description: { $regex: "query", $options: "i" } }
  ],
  $or: [
    { discountPrice: { $gte: minPrice, $lte: maxPrice } },
    { price: { $gte: minPrice, $lte: maxPrice } }
  ]
}
```

---

## Configuration

### Environment Variables

Add to `.env`:

```env
# ElasticSearch Configuration
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=your-username  # Optional
ELASTICSEARCH_PASSWORD=your-password  # Optional
```

### Dependencies

Install ElasticSearch client:
```bash
npm install @elastic/elasticsearch
```

### ElasticSearch Setup

1. **Install ElasticSearch:**
   ```bash
   # Using Docker
   docker run -d -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" elasticsearch:8.11.0
   ```

2. **Create Index:**
   ```bash
   POST /api/search/index/create
   ```

3. **Sync Products:**
   ```bash
   POST /api/search/sync
   ```

---

## Best Practices

### 1. Synonym Management
- Update synonyms in `indexService.js`
- Use `POST /api/search/index/update-settings` to apply changes
- Keep synonyms relevant to your product catalog

### 2. Performance
- Limit results per page (max: 100)
- Use pagination for large result sets
- Monitor ElasticSearch cluster health

### 3. Error Handling
- Always handle ElasticSearch failures gracefully
- Use fallback to MongoDB for reliability
- Log sync errors for monitoring

### 4. Data Consistency
- Sync happens automatically on product changes
- Manual sync available for bulk operations
- Monitor sync status via health check

---

## Example Use Cases

### Use Case 1: Bengali Search
**Query:** `GET /api/search/search?q=পাখা`

**Result:** Returns all products matching "fan", "পাখা", "ventilator", "ceiling fan"

### Use Case 2: Price Range + Category
**Query:** `GET /api/search/search?q=phone&minPrice=10000&maxPrice=50000&categoryId=CAT_ID&sort=price_asc`

**Result:** Returns phones in price range, sorted by price (low to high)

### Use Case 3: Typo Tolerance
**Query:** `GET /api/search/search?q=ceiling fann` (typo: "fann")

**Result:** Still matches "ceiling fan" due to fuzzy matching

### Use Case 4: Mixed Language
**Query:** `GET /api/search/search?q=সিলিং পাখা কম দামে`

**Result:** Matches "ceiling fan" with low price filter

---

## Testing Checklist

- [ ] Search with Bengali query
- [ ] Search with English query
- [ ] Search with mixed language
- [ ] Test fuzzy matching (typos)
- [ ] Test synonym matching
- [ ] Test price range filter
- [ ] Test category/brand/vendor filters
- [ ] Test sorting options
- [ ] Test pagination
- [ ] Test fallback to MongoDB
- [ ] Test health check
- [ ] Test product sync
- [ ] Test index creation

---

## Troubleshooting

### Issue: ElasticSearch Connection Failed
**Solution:** Check ElasticSearch URL and credentials in `.env`

### Issue: No Search Results
**Solution:** 
1. Check if index exists: `GET /api/search/health`
2. Sync products: `POST /api/search/sync`
3. Verify products are active and in stock

### Issue: Synonyms Not Working
**Solution:**
1. Update synonyms in `indexService.js`
2. Run: `POST /api/search/index/update-settings`
3. Re-index products: `POST /api/search/sync`

### Issue: Slow Search Performance
**Solution:**
1. Check ElasticSearch cluster health
2. Optimize index settings
3. Use pagination to limit results
4. Consider increasing ElasticSearch resources

---

## Future Enhancements

1. **Auto-complete/Suggestions:** Implement search suggestions
2. **Faceted Search:** Add filters for multiple categories/brands
3. **Personalization:** Rank results based on user preferences
4. **Analytics:** Track popular searches and search patterns
5. **Multi-field Boost:** Adjust field weights based on performance
6. **Phrase Matching:** Improve exact phrase matching
7. **Stemming:** Add word stemming for better matching
8. **Search History:** Store and analyze search queries

---

## Security Considerations

1. **Rate Limiting:** Implement rate limiting for search endpoints
2. **Input Validation:** Validate and sanitize search queries
3. **Access Control:** Protect admin endpoints (sync, index management)
4. **Error Messages:** Don't expose internal errors to clients
5. **Timeout Handling:** Set appropriate timeouts for ElasticSearch queries

---

## Performance Metrics

- **Search Latency:** < 200ms (ElasticSearch), < 500ms (MongoDB fallback)
- **Sync Latency:** < 100ms per product (non-blocking)
- **Index Size:** Optimize for < 1GB per 100K products
- **Query Throughput:** Support 1000+ queries/second

---

## Support

For issues or questions:
1. Check ElasticSearch logs
2. Review sync service logs
3. Verify index health: `GET /api/search/health`
4. Test with simple queries first

