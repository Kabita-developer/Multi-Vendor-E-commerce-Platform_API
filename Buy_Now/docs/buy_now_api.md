# Buy Now API Documentation

## Overview

This document describes the Buy Now (Direct Order) API for customers. The Buy Now feature allows customers to place orders directly from the product page without adding products to the cart. It reuses the existing checkout logic, ensuring consistency with cart-based checkout.

**Base URL:** `/api/orders`

**Authentication:** All Buy Now endpoints require JWT authentication with customer role.

---

## BUY NOW

### Endpoint

`POST /api/orders/buy-now`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can use Buy Now
- Product must exist, be active, and have sufficient stock
- Buy Now creates a temporary cart internally (not saved to database)
- Reuses existing checkout, payment, commission, and settlement logic
- Orders are created with status `PENDING`

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | String | Yes | Product ID (MongoDB ObjectId) |
| `quantity` | Number | Yes | Quantity to purchase (must be > 0) |
| `addressId` | String | No | Address ID (currently uses customer's default address) |
| `couponCode` | String | No | Coupon code for discount |
| `paymentMethod` | String | Yes | Payment method: `"ONLINE"` or `"COD"` |

### Request Example

```json
{
  "productId": "694129c27f75e93fd924715d",
  "quantity": 1,
  "couponCode": "SAVE10",
  "paymentMethod": "ONLINE"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/orders/buy-now \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "694129c27f75e93fd924715d",
    "quantity": 1,
    "paymentMethod": "ONLINE"
  }'
```

### Buy Now Flow (Step by Step)

1. **Authenticate user** using JWT token
2. **Validate request body:**
   - `productId` must be valid MongoDB ObjectId
   - `quantity` must be a positive number > 0
   - `paymentMethod` must be `"ONLINE"` or `"COD"`
3. **Fetch and validate product:**
   - Product must exist
   - Product must be active (`isActive: true`)
   - Stock must be sufficient (`stock >= quantity`)
4. **Create temporary cart structure:**
   - Build cart object in memory (not saved to database)
   - Group by vendor (single product = single vendor)
   - Calculate item price (prefer `discountPrice`, fallback to `price`)
   - Calculate item total (`price * quantity`)
5. **Attach temp cart to request:**
   - Set `req.tempCart` with temporary cart structure
6. **Reuse checkout logic:**
   - Call existing checkout function
   - Checkout detects temp cart and uses it instead of database cart
   - All checkout validations apply (coupon, stock, etc.)
7. **Create order(s):**
   - Order created with `orderStatus = "PENDING"`
   - Order created with `paymentStatus = "PENDING"`
   - Stock deducted atomically
   - Coupon applied if valid
8. **Return response** with order details and payment info

### Temporary Cart Structure

The Buy Now feature creates a temporary cart object in memory (not persisted):

```javascript
{
  userId: ObjectId,
  vendors: [
    {
      vendorId: ObjectId,
      items: [
        {
          productId: ObjectId,
          name: String,
          price: Number,        // discountPrice or price
          quantity: Number,
          total: Number         // price * quantity
        }
      ],
      vendorSubTotal: Number   // Sum of items
    }
  ],
  grandTotal: Number           // Sum of vendor subtotals
}
```

### Success Response

**Status Code:** `200 OK`

#### For ONLINE Payment

```json
{
  "success": true,
  "message": "Checkout initiated successfully",
  "paymentRequired": true,
  "totalAmount": 1199.99,
  "orderIds": [
    "694129c27f75e93fd924715d"
  ],
  "orders": [
    {
      "orderId": "694129c27f75e93fd924715d",
      "orderNumber": "ORD-1704067200000-1234",
      "vendorId": "693fbef1493989b8b80a31a6",
      "payableAmount": 1079.99,
      "orderStatus": "PENDING",
      "paymentStatus": "PENDING"
    }
  ],
  "paymentInfo": {
    "paymentIntentId": null,
    "paymentUrl": null,
    "message": "Payment gateway integration pending"
  }
}
```

#### For COD Payment

```json
{
  "success": true,
  "message": "Checkout initiated successfully",
  "paymentRequired": false,
  "totalAmount": 1199.99,
  "orderIds": [
    "694129c27f75e93fd924715d"
  ],
  "orders": [
    {
      "orderId": "694129c27f75e93fd924715d",
      "orderNumber": "ORD-1704067200000-1234",
      "vendorId": "693fbef1493989b8b80a31a6",
      "payableAmount": 1199.99,
      "orderStatus": "PENDING",
      "paymentStatus": "PENDING"
    }
  ],
  "paymentInfo": null
}
```

### Error Responses

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

#### Invalid Quantity

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Quantity must be a positive number greater than 0"
}
```

#### Invalid Payment Method

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Payment method must be either ONLINE or COD"
}
```

#### Invalid Coupon

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid or expired coupon code"
}
```

#### Unauthorized Access

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

---

## Business Rules

### Buy Now Specific Rules

1. **Single Product Only:**
   - Buy Now is designed for purchasing a single product
   - Multiple products require using the cart system

2. **No Cart Storage:**
   - Buy Now does not save products to the cart
   - Temporary cart is created in memory only
   - Cart is not persisted to the database

3. **Stock Validation:**
   - Stock is validated before order creation
   - Stock is deducted atomically using MongoDB transactions
   - Prevents overselling

4. **Price Validation:**
   - Uses current product price at time of purchase
   - Prefers `discountPrice` if available, otherwise uses `price`
   - Price is snapshotted in order (prevents price changes)

5. **Multi-Vendor Support:**
   - Buy Now creates one order per product (one vendor)
   - Reuses existing multi-vendor checkout logic
   - No special case handling needed

### Shared Rules (with Cart Checkout)

1. **Coupon Application:**
   - Coupons can be applied if valid
   - Coupon validation (active, not expired, usage limit)
   - Platform/vendor-specific coupon logic applies

2. **Payment Processing:**
   - Supports ONLINE and COD payment methods
   - Payment status set to `PENDING` initially
   - Payment gateway integration pending

3. **Order Status:**
   - Orders created with `orderStatus = "PENDING"`
   - Orders follow same lifecycle as cart-based orders

4. **Commission & Settlement:**
   - Uses existing commission calculation logic
   - Vendor wallet credits apply
   - Settlement process unchanged

---

## Technical Implementation

### Architecture

The Buy Now feature is implemented by:

1. **Buy Now Controller** (`Buy_Now/controllers/buyNowController.js`):
   - Validates product and stock
   - Creates temporary cart structure
   - Attaches temp cart to request object
   - Calls existing checkout function

2. **Modified Checkout Controller** (`Checkout_System/controllers/checkoutController.js`):
   - Checks for `req.tempCart` first
   - If temp cart exists, uses it instead of database cart
   - If temp cart doesn't exist, fetches from database (normal flow)
   - Skips cart deletion if temp cart (not persisted)

3. **Code Reuse:**
   - All checkout logic is reused
   - No duplication of validation, order creation, or payment logic
   - Consistent behavior between cart checkout and Buy Now

### Temporary Cart vs Database Cart

| Aspect | Temporary Cart (Buy Now) | Database Cart (Checkout) |
|--------|---------------------------|--------------------------|
| Storage | In-memory only | MongoDB database |
| Persistence | Not saved | Saved to database |
| Lifecycle | Created per request | Exists until checkout |
| Deletion | Not needed (in-memory) | Deleted after checkout |
| Access | Via `req.tempCart` | Via `Cart.findOne()` |

---

## Security & Best Practices

### Security

1. **Authentication Required:**
   - All Buy Now endpoints require valid JWT token
   - Only customers can use Buy Now

2. **Input Validation:**
   - Product ID format validation
   - Quantity validation (must be > 0)
   - Payment method validation

3. **Stock Prevention:**
   - Validates stock before order creation
   - Atomic stock deduction using transactions
   - Prevents race conditions

4. **Price Protection:**
   - Uses current product price
   - Price snapshotted in order
   - Prevents price manipulation

### Best Practices

1. **Code Reuse:**
   - Buy Now reuses checkout logic
   - No code duplication
   - Consistent behavior

2. **Transaction Safety:**
   - Uses MongoDB transactions
   - Atomic operations
   - Rollback on errors

3. **Error Handling:**
   - Comprehensive error messages
   - Proper HTTP status codes
   - User-friendly messages

4. **Performance:**
   - No database writes for temp cart
   - Efficient product validation
   - Minimal overhead

---

## Comparison: Buy Now vs Cart Checkout

| Feature | Buy Now | Cart Checkout |
|---------|---------|---------------|
| **Products** | Single product | Multiple products |
| **Cart Storage** | No (temp only) | Yes (persisted) |
| **Use Case** | Quick purchase | Multiple items |
| **Checkout Logic** | Reused | Original |
| **Payment** | Same | Same |
| **Commission** | Same | Same |
| **Order Creation** | Same | Same |

---

## Future Enhancements

1. **Rate Limiting:**
   - Add rate limiting to prevent abuse
   - Limit Buy Now requests per user

2. **Analytics:**
   - Track Buy Now usage
   - Compare with cart checkout

3. **Optimization:**
   - Cache product data
   - Optimize stock validation

4. **Features:**
   - Buy Now with multiple products (add to temp cart)
   - Save Buy Now items to cart option

---

## Examples

### Example 1: Buy Now with ONLINE Payment

**Request:**
```json
POST /api/orders/buy-now
{
  "productId": "694129c27f75e93fd924715d",
  "quantity": 2,
  "paymentMethod": "ONLINE"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Checkout initiated successfully",
  "paymentRequired": true,
  "totalAmount": 2399.98,
  "orderIds": ["694129c27f75e93fd924715d"],
  "orders": [...],
  "paymentInfo": {...}
}
```

### Example 2: Buy Now with Coupon

**Request:**
```json
POST /api/orders/buy-now
{
  "productId": "694129c27f75e93fd924715d",
  "quantity": 1,
  "couponCode": "SAVE10",
  "paymentMethod": "COD"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Checkout initiated successfully",
  "paymentRequired": false,
  "totalAmount": 1079.99,
  "orderIds": ["694129c27f75e93fd924715d"],
  "orders": [...]
}
```

---

## Support

For issues or questions regarding the Buy Now API, please contact the development team or refer to the main checkout API documentation.

