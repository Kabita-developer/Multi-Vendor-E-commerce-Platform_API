# Cart API Documentation

## Overview

This document describes the Cart management APIs for customers. The cart system supports multi-vendor grouping, allowing customers to add products from different vendors and checkout with vendor-wise order splitting.

**Base URL:** `/api/cart`

**Authentication:** All cart endpoints require JWT authentication with customer role.

---

## ADD TO CART

### Endpoint

`POST /api/cart/add`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can add items to cart
- One cart per customer (automatically created if doesn't exist)
- Products are grouped by vendor
- Cart stores products vendor-wise for order splitting

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | String | Yes | Product ID (MongoDB ObjectId) |
| `quantity` | Number | Yes | Quantity to add (must be > 0) |

### Request Example

```json
{
  "productId": "694129c27f75e93fd924715d",
  "quantity": 2
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/cart/add \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "694129c27f75e93fd924715d",
    "quantity": 2
  }'
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Validate `productId` and `quantity` (quantity > 0)
3. Find product by `productId`
4. Check product exists and is active (`isActive: true`)
5. Check stock availability (`stock >= quantity`)
6. Identify `vendorId` from product
7. Find user's cart or create new cart
8. If vendor bucket exists:
   - If product exists → update quantity & total
   - Else → push product into vendor.items
9. If vendor bucket doesn't exist:
   - Create new vendor group
10. Recalculate `vendorSubTotal`
11. Recalculate `grandTotal`
12. Save cart
13. Return success response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "cartId": "694129c27f75e93fd924715d",
    "grandTotal": 1999.98,
    "vendorsCount": 2
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `data` | Object | Response data |
| `data.cartId` | String | Cart ID (MongoDB ObjectId) |
| `data.grandTotal` | Number | Total amount of all items in cart |
| `data.vendorsCount` | Number | Number of vendors in cart |

### Error Responses

#### Missing Product ID
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Product ID is required"
}
```

#### Invalid Quantity
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Quantity must be a positive number greater than 0"
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

#### Product Not Available
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Product is not available"
}
```

#### Insufficient Stock
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Insufficient stock. Available: 5, Requested: 10"
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

#### Access Denied
**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "Access denied. Customer role required."
}
```

### Notes

1. **Price Snapshot:** Product price is stored at the time of adding to cart (uses `discountPrice` if available, else `price`)
2. **Stock Validation:** Stock is checked before adding/updating items
3. **Quantity Update:** If product already exists in cart, quantity is added to existing quantity
4. **Vendor Grouping:** Products are automatically grouped by vendor
5. **One Cart Per User:** Each customer has exactly one cart (unique `userId`)

---

## VIEW CART

### Endpoint

`GET /api/cart`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can view their cart
- Returns empty cart if no items exist

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### Request Example

```bash
curl -X GET http://localhost:3000/api/cart \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Fetch cart by `userId`
3. Populate `vendorId` (shopName, ownerName)
4. Populate `productId` (name, price, mainImage)
5. Calculate:
   - Item total = price * quantity
   - Vendor subtotal
   - Grand total
6. Return vendor-wise grouped cart response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "cart": {
    "vendors": [
      {
        "vendor": {
          "id": "693fbef1493989b8b80a31a6",
          "shopName": "Tech Store",
          "ownerName": "John Doe"
        },
        "items": [
          {
            "productId": "694129c27f75e93fd924715d",
            "name": "iPhone 15 Pro",
            "price": 999.99,
            "quantity": 2,
            "total": 1999.98,
            "image": {
              "original": "https://s3.amazonaws.com/bucket/products/main-image-original.jpg",
              "size100": "https://s3.amazonaws.com/bucket/products/main-image-100px.jpg",
              "size200": "https://s3.amazonaws.com/bucket/products/main-image-200px.jpg"
            }
          }
        ],
        "vendorSubTotal": 1999.98
      },
      {
        "vendor": {
          "id": "693fbef1493989b8b80a31a7",
          "shopName": "Fashion Hub",
          "ownerName": "Jane Smith"
        },
        "items": [
          {
            "productId": "694129c27f75e93fd924715e",
            "name": "Designer T-Shirt",
            "price": 49.99,
            "quantity": 1,
            "total": 49.99,
            "image": {
              "original": "https://s3.amazonaws.com/bucket/products/main-image-original.jpg",
              "size100": "https://s3.amazonaws.com/bucket/products/main-image-100px.jpg",
              "size200": "https://s3.amazonaws.com/bucket/products/main-image-200px.jpg"
            }
          }
        ],
        "vendorSubTotal": 49.99
      }
    ],
    "grandTotal": 2049.97
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `cart` | Object | Cart data |
| `cart.vendors` | Array | Array of vendor groups |
| `cart.grandTotal` | Number | Total amount of all items across all vendors |

#### Vendor Object

| Field | Type | Description |
|-------|------|-------------|
| `vendor` | Object | Vendor information |
| `vendor.id` | String | Vendor ID |
| `vendor.shopName` | String | Shop name |
| `vendor.ownerName` | String | Owner name |
| `items` | Array | Array of cart items |
| `vendorSubTotal` | Number | Subtotal for this vendor's items |

#### Cart Item Object

| Field | Type | Description |
|-------|------|-------------|
| `productId` | String | Product ID |
| `name` | String | Product name |
| `price` | Number | Item price (uses discountPrice if available) |
| `quantity` | Number | Quantity in cart |
| `total` | Number | Total for this item (price * quantity) |
| `image` | Object | Main product image with 3 sizes (null if not available) |

### Empty Cart Response

If cart doesn't exist or is empty:

```json
{
  "success": true,
  "cart": {
    "vendors": [],
    "grandTotal": 0
  }
}
```

### Error Responses

#### Authentication Error
**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

#### Access Denied
**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "Access denied. Customer role required."
}
```

#### Customer Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Customer not found"
}
```

### Notes

1. **Price Calculation:** Uses current product price (discountPrice if available, else price) for display
2. **Vendor Grouping:** Items are grouped by vendor for easy order splitting
3. **Empty Cart:** Returns empty structure if cart doesn't exist
4. **Real-time Prices:** Cart view shows current product prices (may differ from stored prices)
5. **Image Display:** Product images are included for better UX

---

## Database Schema

### Cart Model

```javascript
{
  userId: ObjectId,        // Reference to Customer
  vendors: [
    {
      vendorId: ObjectId, // Reference to Vendor
      items: [
        {
          productId: ObjectId, // Reference to Product
          name: String,         // Product name snapshot
          price: Number,        // Price snapshot (discountPrice or price)
          quantity: Number,    // Quantity in cart
          total: Number        // price * quantity
        }
      ],
      vendorSubTotal: Number   // Sum of all items in this vendor group
    }
  ],
  grandTotal: Number,     // Sum of all vendor subtotals
  updatedAt: Date         // Last update timestamp
}
```

### Key Features

- **One Cart Per Customer:** `userId` is unique
- **Vendor-Wise Grouping:** Products grouped by vendor for order splitting
- **Price Snapshot:** Product price stored at add time
- **Automatic Calculations:** Subtotals and grand total calculated automatically

---

## Security & Best Practices

### Security

1. **Authentication Required:** All endpoints require valid JWT token
2. **Role Validation:** Only customers can access cart APIs
3. **User Isolation:** Customers can only access their own cart
4. **Input Validation:** All inputs are validated before processing
5. **Stock Validation:** Prevents adding more items than available stock

### Best Practices

1. **One Cart Per User:** Enforced at database level (unique userId)
2. **Quantity Validation:** Quantity must be > 0
3. **Stock Prevention:** Prevents quantity exceeding available stock
4. **Price Snapshot:** Uses product price at time of adding (prevents price changes)
5. **Soft Handling:** Gracefully handles inactive products
6. **Error Handling:** Comprehensive error messages for debugging
7. **Async/Await:** Uses async/await with try/catch for error handling

### Performance

1. **Indexes:** Cart model has index on `userId` for fast lookups
2. **Population:** Efficient population of vendor and product data
3. **Lean Queries:** Uses lean() for read-only queries where appropriate

---

## Example Use Cases

### 1. Add Single Item to Cart

```bash
POST /api/cart/add
{
  "productId": "694129c27f75e93fd924715d",
  "quantity": 1
}
```

### 2. Add Multiple Items from Same Vendor

```bash
# Add first product
POST /api/cart/add
{
  "productId": "694129c27f75e93fd924715d",
  "quantity": 2
}

# Add second product from same vendor
POST /api/cart/add
{
  "productId": "694129c27f75e93fd924715e",
  "quantity": 1
}
```

### 3. Add Items from Different Vendors

```bash
# Add product from Vendor A
POST /api/cart/add
{
  "productId": "694129c27f75e93fd924715d",  # Vendor A
  "quantity": 2
}

# Add product from Vendor B
POST /api/cart/add
{
  "productId": "694129c27f75e93fd924715f",  # Vendor B
  "quantity": 1
}
```

### 4. Update Existing Item Quantity

```bash
# Add item with quantity 2
POST /api/cart/update
{
  "productId": "694129c27f75e93fd924715d",
  "quantity": 2
}

# Add same item again with quantity 1 (total becomes 3)
POST /api/cart/update
{
  "productId": "694129c27f75e93fd924715d",
  "quantity": 1
}
```

### 5. View Cart

```bash
GET /api/cart
```

---

## REMOVE ITEM FROM CART

### Endpoint

`POST /api/cart/remove`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field       | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| `productId` | String | Yes      | Product ID to remove from cart |

### Request Example

```bash
POST /api/cart/remove
{
  "productId": "694129c27f75e93fd924715d"
}
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Validate `productId` format
3. Find cart by `userId`
4. Iterate vendor groups and remove the item with matching `productId`
5. Remove vendor groups that have no items left
6. Recalculate `vendorSubTotal` for each vendor and `grandTotal` for the cart
7. If cart becomes empty, delete the cart document
8. Return updated cart response

### Success Response

```json
{
  "success": true,
  "message": "Item removed from cart successfully",
  "cart": {
    "vendors": [
      {
        "vendor": { "id": "VENDOR_ID", "shopName": "Tech Store" },
        "items": [
          {
            "productId": "OTHER_PRODUCT_ID",
            "name": "Another Product",
            "price": 999.99,
            "quantity": 1,
            "total": 999.99
          }
        ],
        "vendorSubTotal": 999.99
      }
    ],
    "grandTotal": 999.99
  }
}
```

### Notes

1. If the specified item is not found in the cart, API returns `404` with message `"Item not found in cart"`.
2. If removing the item makes the cart empty, the cart document is deleted and an empty cart structure is returned.

---

## CLEAR CART

### Endpoint

`POST /api/cart/clear`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

No body required.

### Request Example

```bash
POST /api/cart/clear
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Find cart by `userId`
3. If cart exists, delete cart document
4. If cart does not exist, treat as already empty
5. Return success response with empty cart structure

### Success Response

```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "cart": {
    "vendors": [],
    "grandTotal": 0
  }
}
```

### Notes

1. Idempotent: calling this API multiple times keeps cart empty and always returns success.
2. Safe to call before checkout to reset cart state.

---

## Future Enhancements

1. **Update Item Quantity:** Separate API to set exact quantity (not just add)
2. **Cart Expiry:** Automatic cart cleanup after inactivity
3. **Save for Later:** Save items for later purchase
4. **Cart Sharing:** Share cart with others
5. **Bulk Operations:** Add multiple items at once
6. **Cart Validation:** Validate cart before checkout

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
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (role/permission denied)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error (server errors)

