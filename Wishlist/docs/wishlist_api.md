# Wishlist API Documentation

## Overview

This document describes the Wishlist management APIs for customers. The wishlist system allows customers to save products they are interested in for later purchase. Unlike the cart, wishlist items don't have quantities and are not used for checkout.

**Base URL:** `/api/wishlist`

**Authentication:** All wishlist endpoints require JWT authentication with customer role.

---

## ADD TO WISHLIST

### Endpoint

`POST /api/wishlist/add`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can add items to wishlist
- One wishlist per customer (automatically created if doesn't exist)
- Duplicate products are prevented (product can only be added once)
- Product must exist in the system

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | String | Yes | Product ID (MongoDB ObjectId) |

### Request Example

```json
{
  "productId": "694129c27f75e93fd924715d"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/wishlist/add \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "694129c27f75e93fd924715d"
  }'
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Validate `productId` format (MongoDB ObjectId)
3. Find product by `productId`
4. Check product exists
5. Find user's wishlist or create new wishlist
6. Check if product already exists in wishlist
7. If not exists, add product to wishlist
8. Save wishlist
9. Return success response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Product added to wishlist successfully",
  "data": {
    "wishlistId": "694129c27f75e93fd924715d",
    "productId": "69412c85e71dfa5e9ace0bd4",
    "totalItems": 5
  }
}
```

### Error Responses

#### Missing Product ID

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Product ID is required"
}
```

#### Invalid Product ID Format

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

#### Product Already in Wishlist

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Product is already in your wishlist"
}
```

#### Unauthorized Access

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

---

## GET WISHLIST

### Endpoint

`GET /api/wishlist`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can view their wishlist
- Returns all products in the customer's wishlist
- Includes product details (name, price, images, vendor, etc.)
- Filters out deleted products automatically

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### Request Example

```bash
curl -X GET http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Find user's wishlist by userId
3. Populate product details (name, price, images, vendor, category, brand)
4. Filter out deleted products (products that no longer exist)
5. Format response with product information
6. Return wishlist items

### Success Response

**Status Code:** `200 OK`

#### Non-Empty Wishlist

```json
{
  "success": true,
  "message": "Wishlist retrieved successfully",
  "data": {
    "items": [
      {
        "wishlistItemId": "694129c27f75e93fd924715d",
        "productId": "69412c85e71dfa5e9ace0bd4",
        "name": "Samsung Galaxy S24 Ultra",
        "slug": "samsung-galaxy-s24-ultra",
        "price": 1299.99,
        "discountPrice": 1199.99,
        "currentPrice": 1199.99,
        "stock": 40,
        "isActive": true,
        "mainImage": {
          "original": "https://example.com/image.jpg",
          "size100": "https://example.com/image-100.jpg",
          "size200": "https://example.com/image-200.jpg"
        },
        "vendor": {
          "id": "693fcf4a1f6d99fd059e1a30",
          "shopName": "Tech Store"
        },
        "category": {
          "id": "694058c357fa30dd144acea3",
          "name": "Electronics"
        },
        "brand": {
          "id": "6940f859d572703fbcec42d8",
          "name": "Samsung"
        },
        "addedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "totalItems": 1
  }
}
```

#### Empty Wishlist

```json
{
  "success": true,
  "message": "Wishlist is empty",
  "data": {
    "items": [],
    "totalItems": 0
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `wishlistItemId` | String | Unique identifier for the wishlist item |
| `productId` | String | Product ID |
| `name` | String | Product name |
| `slug` | String | Product slug (URL-friendly identifier) |
| `price` | Number | Original product price |
| `discountPrice` | Number | Discounted price (if available) |
| `currentPrice` | Number | Current price (discountPrice or price) |
| `stock` | Number | Available stock quantity |
| `isActive` | Boolean | Whether product is active |
| `mainImage` | Object | Product main image (original, size100, size200) |
| `vendor` | Object | Vendor information (id, shopName) |
| `category` | Object | Category information (id, name) |
| `brand` | Object | Brand information (id, name) |
| `addedAt` | String | ISO date when product was added to wishlist |

### Error Responses

#### Unauthorized Access

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

---

## REMOVE FROM WISHLIST

### Endpoint

`POST /api/wishlist/remove/:id`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can remove items from their wishlist
- Product ID must be provided in URL parameter
- Product must exist in the customer's wishlist

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | String | Yes | Product ID to remove from wishlist |

### Request Example

```bash
curl -X POST http://localhost:3000/api/wishlist/remove/69412c85e71dfa5e9ace0bd4 \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Validate product ID format (MongoDB ObjectId)
3. Find user's wishlist by userId
4. Check if wishlist exists and is not empty
5. Find product in wishlist items
6. If found, remove product from wishlist
7. Save wishlist
8. Return success response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Product removed from wishlist successfully",
  "data": {
    "productId": "69412c85e71dfa5e9ace0bd4",
    "totalItems": 4
  }
}
```

### Error Responses

#### Invalid Product ID Format

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid product ID format"
}
```

#### Wishlist Empty or Not Found

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Wishlist is empty or not found"
}
```

#### Product Not Found in Wishlist

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Product not found in wishlist"
}
```

#### Unauthorized Access

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

---

## Database Schema

### Wishlist Model

```javascript
{
  userId: ObjectId,        // Reference to Customer (unique)
  items: [
    {
      productId: ObjectId, // Reference to Product
      addedAt: Date         // When product was added
    }
  ],
  createdAt: Date,        // When wishlist was created
  updatedAt: Date          // Last update timestamp
}
```

### Key Features

- **One Wishlist Per Customer:** `userId` is unique
- **No Duplicates:** Same product cannot be added twice
- **Product References:** Stores product IDs, not full product data
- **Automatic Cleanup:** Deleted products are filtered out when fetching

---

## Business Rules

### Wishlist Rules

1. **One Wishlist Per Customer:**
   - Each customer has exactly one wishlist
   - Wishlist is automatically created on first add

2. **No Duplicates:**
   - Same product can only be added once
   - Attempting to add duplicate returns error

3. **Product Validation:**
   - Product must exist in the system
   - Deleted products are automatically filtered out

4. **No Quantity:**
   - Wishlist items don't have quantities
   - Unlike cart, wishlist is for saving products, not purchasing

5. **Product Details:**
   - Product information is populated when fetching
   - Includes vendor, category, brand information

### Comparison: Wishlist vs Cart

| Feature | Wishlist | Cart |
|---------|----------|------|
| **Purpose** | Save for later | Purchase immediately |
| **Quantity** | No quantity | Has quantity |
| **Checkout** | Cannot checkout | Can checkout |
| **Duplicates** | Prevented | Allowed (updates quantity) |
| **Vendor Grouping** | No grouping | Grouped by vendor |
| **Price Snapshot** | No | Yes (at add time) |

---

## Security & Best Practices

### Security

1. **Authentication Required:**
   - All endpoints require valid JWT token
   - Only customers can access wishlist APIs

2. **User Isolation:**
   - Customers can only access their own wishlist
   - User ID extracted from JWT token (never from request body)

3. **Input Validation:**
   - Product ID format validation
   - Product existence validation

4. **Data Protection:**
   - Prevents duplicate entries
   - Filters out deleted products

### Best Practices

1. **One Wishlist Per User:**
   - Enforced at database level (unique userId)
   - Automatically created on first use

2. **Efficient Queries:**
   - Indexed on `userId` for fast lookups
   - Indexed on `items.productId` for product searches

3. **Product Population:**
   - Efficient population of product details
   - Includes related data (vendor, category, brand)

4. **Error Handling:**
   - Comprehensive error messages
   - Proper HTTP status codes
   - User-friendly messages

5. **Performance:**
   - Indexes for fast lookups
   - Lean queries for better performance
   - Filters deleted products automatically

---

## Examples

### Example 1: Add Product to Wishlist

**Request:**
```bash
POST /api/wishlist/add
{
  "productId": "69412c85e71dfa5e9ace0bd4"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product added to wishlist successfully",
  "data": {
    "wishlistId": "694129c27f75e93fd924715d",
    "productId": "69412c85e71dfa5e9ace0bd4",
    "totalItems": 1
  }
}
```

### Example 2: Get Wishlist

**Request:**
```bash
GET /api/wishlist
```

**Response:**
```json
{
  "success": true,
  "message": "Wishlist retrieved successfully",
  "data": {
    "items": [
      {
        "wishlistItemId": "694129c27f75e93fd924715d",
        "productId": "69412c85e71dfa5e9ace0bd4",
        "name": "Samsung Galaxy S24 Ultra",
        "currentPrice": 1199.99,
        "stock": 40,
        "isActive": true,
        "mainImage": {...},
        "vendor": {...},
        "category": {...},
        "brand": {...},
        "addedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "totalItems": 1
  }
}
```

### Example 3: Remove Product from Wishlist

**Request:**
```bash
POST /api/wishlist/remove/69412c85e71dfa5e9ace0bd4
```

**Response:**
```json
{
  "success": true,
  "message": "Product removed from wishlist successfully",
  "data": {
    "productId": "69412c85e71dfa5e9ace0bd4",
    "totalItems": 0
  }
}
```

---

## Future Enhancements

1. **Bulk Operations:**
   - Add multiple products at once
   - Remove multiple products at once
   - Clear entire wishlist

2. **Wishlist Sharing:**
   - Share wishlist with others
   - Public wishlist links

3. **Notifications:**
   - Price drop alerts
   - Stock availability alerts
   - Product back in stock notifications

4. **Analytics:**
   - Most wishlisted products
   - Wishlist to purchase conversion

5. **Features:**
   - Move wishlist item to cart
   - Wishlist categories/tags
   - Wishlist notes

---

## Support

For issues or questions regarding the Wishlist API, please contact the development team or refer to the Cart API documentation for similar patterns.

