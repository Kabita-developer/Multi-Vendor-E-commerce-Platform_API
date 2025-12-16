# Review & Rating API Documentation

## Overview

This document describes the Review & Rating API for customers. This API allows customers to submit reviews and ratings for products they have received (DELIVERED orders only).

**Base URL:** `/api/reviews`

**Authentication:** All review endpoints require JWT authentication with customer role.

---

## SUBMIT REVIEW

### Endpoint

`POST /api/reviews/:productId`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can submit reviews
- Customer must have at least one DELIVERED order containing the product
- One customer can review a product only once
- Rating must be between 1 and 5

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rating` | Number | Yes | Rating (must be integer between 1 and 5) |
| `comment` | String | No | Review comment (optional) |

### Request Example

```json
{
  "rating": 5,
  "comment": "Excellent product! Very satisfied with the quality and delivery."
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/reviews/694129c27f75e93fd924715d \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Great product!"
  }'
```

### Controller Logic (Step by Step)

1. **Authenticate user** using JWT token
2. **Ensure user role** is "customer"
3. **Extract productId** from params
4. **Validate request body:**
   - `rating` must be integer between 1 and 5
   - `comment` is optional but must be non-empty string if provided
5. **Check if user has a DELIVERED order** containing the productId
6. **If not found** → return error: "You can review only delivered products"
7. **Check for existing review** by same user for same product
8. **If exists** → return error: "You have already reviewed this product"
9. **Create new review document**
10. **Recalculate product rating:**
    - Average rating (using aggregation)
    - Total review count
11. **Update product rating fields**
12. **Recalculate vendor rating** using all reviews of vendor products
13. **Update vendor rating fields**
14. **Return success response**

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "reviewId": "694129c27f75e93fd924715d",
    "productId": "694129c27f75e93fd924715e",
    "rating": 5
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `data` | Object | Response data |
| `data.reviewId` | String | Review ID |
| `data.productId` | String | Product ID |
| `data.rating` | Number | Rating submitted |

### Error Responses

#### Missing Rating
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Rating is required and must be a number"
}
```

#### Invalid Rating
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Rating must be an integer between 1 and 5"
}
```

#### Invalid Product ID
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid product ID format"
}
```

#### Product Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Product not found"
}
```

#### No Delivered Order
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "You can review only delivered products. Please ensure you have a delivered order containing this product."
}
```

#### Duplicate Review
**Status Code:** `409 Conflict`

```json
{
  "success": false,
  "message": "You have already reviewed this product"
}
```

#### Authentication Error
**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

### Notes

1. **Delivered-Only Validation:** Strict validation ensures only customers with DELIVERED orders can review
2. **One Review Per Product:** Unique constraint prevents duplicate reviews
3. **Rating Calculation:** Uses MongoDB aggregation for accurate average calculation
4. **Automatic Updates:** Product and vendor ratings updated automatically
5. **Transaction Safety:** Uses MongoDB transactions for atomicity

---

## Database Schema

### Review Model

```javascript
{
  userId: ObjectId,        // Reference to Customer
  productId: ObjectId,     // Reference to Product
  vendorId: ObjectId,      // Reference to Vendor
  rating: Number,          // Rating (1-5)
  comment: String,         // Optional review comment
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- Unique compound index: `{ userId: 1, productId: 1 }` (one review per user per product)
- Index on `productId` for fast product review queries
- Index on `vendorId` for vendor rating calculation
- Index on `rating` for filtering/sorting

### Product Model (Rating Fields)

```javascript
{
  // ... other product fields
  rating: Number,          // Average rating (0-5)
  reviewCount: Number     // Total number of reviews
}
```

### Vendor Model (Rating Fields)

```javascript
{
  // ... other vendor fields
  rating: Number,         // Average rating (0-5)
  totalReviews: Number    // Total number of reviews across all products
}
```

---

## Rating Calculation

### Product Rating

**Formula:**
```
averageRating = SUM(all ratings) / COUNT(reviews)
```

**Implementation:**
- Uses MongoDB aggregation pipeline
- Calculates average and count in single query
- Updates product document with new values
- Rounded to 2 decimal places

### Vendor Rating

**Formula:**
```
vendorRating = SUM(all ratings for vendor's products) / COUNT(all reviews for vendor's products)
```

**Implementation:**
- Aggregates all reviews for vendor's products
- Calculates average across all vendor product reviews
- Updates vendor document with new values
- Rounded to 2 decimal places

---

## Business Rules

### Review Eligibility

1. **Delivered Order Required:** Customer must have at least one DELIVERED order containing the product
2. **One Review Per Product:** Each customer can review a product only once
3. **Rating Range:** Rating must be integer between 1 and 5
4. **Comment Optional:** Comment is optional but must be non-empty if provided

### Rating Updates

1. **Product Rating:** Updated immediately after review submission
2. **Vendor Rating:** Updated immediately after review submission
3. **Automatic Calculation:** Uses aggregation for accurate averages
4. **Real-Time Updates:** Ratings reflect immediately

---

## Example Scenarios

### Scenario 1: Valid Review Submission

**Customer:** Has DELIVERED order with product  
**Previous Review:** None  
**Request:** `{ "rating": 5, "comment": "Great product!" }`  
**Result:** ✅ Review created, product and vendor ratings updated

### Scenario 2: No Delivered Order

**Customer:** Has no DELIVERED order with product  
**Request:** `{ "rating": 5 }`  
**Result:** ❌ Error: "You can review only delivered products"

### Scenario 3: Duplicate Review

**Customer:** Already reviewed this product  
**Request:** `{ "rating": 4 }`  
**Result:** ❌ Error: "You have already reviewed this product"

### Scenario 4: Invalid Rating

**Request:** `{ "rating": 6 }`  
**Result:** ❌ Error: "Rating must be an integer between 1 and 5"

---

## Security & Best Practices

### Security

1. **Delivered-Only Validation:** Mandatory check for DELIVERED orders
2. **Ownership Validation:** Customers can only review products they've received
3. **Duplicate Prevention:** Unique constraint prevents duplicate reviews
4. **Rating Validation:** Server-side validation (never trust frontend)

### Best Practices

1. **Aggregation for Accuracy:** Uses MongoDB aggregation for rating calculation
2. **Transaction Safety:** All operations use MongoDB transactions
3. **Automatic Updates:** Product and vendor ratings updated automatically
4. **Error Handling:** Comprehensive error messages
5. **Data Integrity:** Unique constraints ensure data consistency

### Performance

1. **Indexes:** Review model has indexes for fast queries
2. **Aggregation:** Efficient rating calculation using aggregation pipeline
3. **Selective Updates:** Only updates rating fields, not entire documents

---

## Rating Calculation Examples

### Example 1: First Review

**Product:** No previous reviews  
**New Review:** Rating 5  
**Result:**
- Product Rating: 5.00
- Product Review Count: 1
- Vendor Rating: 5.00 (if first review for vendor)
- Vendor Total Reviews: 1

### Example 2: Multiple Reviews

**Product:** Existing reviews: [5, 4, 5]  
**New Review:** Rating 3  
**Result:**
- Product Rating: (5 + 4 + 5 + 3) / 4 = 4.25
- Product Review Count: 4

### Example 3: Vendor Rating

**Vendor Products:** 3 products  
**Product 1 Reviews:** [5, 4] (avg: 4.5)  
**Product 2 Reviews:** [5, 5, 4] (avg: 4.67)  
**Product 3 Reviews:** [3] (avg: 3.0)  
**Vendor Rating:** (5 + 4 + 5 + 5 + 4 + 3) / 6 = 4.33

---

## Testing Checklist

- [ ] Submit review with valid rating (1-5)
- [ ] Submit review with comment
- [ ] Submit review without comment
- [ ] Prevent review without delivered order
- [ ] Prevent duplicate review
- [ ] Validate rating range (1-5)
- [ ] Validate rating is integer
- [ ] Product rating calculation
- [ ] Vendor rating calculation
- [ ] Invalid product ID validation
- [ ] Product not found handling
- [ ] Authentication required
- [ ] Customer role validation

---

## Future Enhancements

1. **Update Review:** Allow customers to update their existing review
2. **Delete Review:** Allow customers to delete their review
3. **Review Replies:** Allow vendors to reply to reviews
4. **Review Helpful Votes:** Allow customers to mark reviews as helpful
5. **Review Images:** Support image uploads in reviews
6. **Review Moderation:** Admin approval for reviews
7. **Review Filtering:** Filter reviews by rating
8. **Review Sorting:** Sort reviews by date, rating, helpfulness
9. **Review Pagination:** Paginated review listing
10. **Review Analytics:** Analytics dashboard for reviews and ratings

---

## Integration Points

### Order Fulfillment Integration

When order status becomes DELIVERED:
- Customer becomes eligible to review products in that order
- Review API validates delivered order before allowing review

### Product Display Integration

Product ratings displayed in:
- Product listing pages
- Product detail pages
- Search results (sort by rating)

### Vendor Display Integration

Vendor ratings displayed in:
- Vendor profile pages
- Vendor listings
- Vendor search results

---

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Clear error message"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors, no delivered order)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (role/permission denied)
- `404` - Not Found (product not found)
- `409` - Conflict (duplicate review)
- `500` - Internal Server Error (server errors)

