# Checkout API Documentation

## Overview

This document describes the Checkout API for customers. The checkout system supports multi-vendor order splitting, coupon application, and payment processing (ONLINE/COD).

**Base URL:** `/api/orders`

**Authentication:** All checkout endpoints require JWT authentication with customer role.

---

## CHECKOUT

### Endpoint

`POST /api/orders/checkout`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can checkout
- Cart must exist and not be empty
- All products must be active and have sufficient stock
- Orders are split vendor-wise automatically

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `addressId` | String | No | Address ID (currently uses customer's default address) |
| `couponCode` | String | No | Coupon code for discount |
| `paymentMethod` | String | Yes | Payment method: `"ONLINE"` or `"COD"` |

### Request Example

```json
{
  "addressId": "optional-address-id",
  "couponCode": "SAVE10",
  "paymentMethod": "ONLINE"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/orders/checkout \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "SAVE10",
    "paymentMethod": "ONLINE"
  }'
```

### Checkout Flow (Step by Step)

1. **Authenticate user** using JWT token
2. **Fetch cart** by userId
3. **Validate cart** exists and not empty
4. **For each cart item:**
   - Fetch product
   - Check product is active
   - Check stock >= quantity
5. **Apply coupon** if couponCode provided:
   - Validate coupon (active, not expired, within usage limit)
   - Calculate discount (platform/vendor specific)
6. **Split cart vendor-wise:**
   - For each vendor create separate order
7. **Create Order documents:**
   - `orderStatus = "PENDING"`
   - `paymentStatus = "PENDING"`
   - Save price snapshot from cart
8. **Deduct stock** for each product (atomic operation using MongoDB transactions)
9. **Calculate grandTotal** (sum of all vendor orders)
10. **Initiate payment:**
    - If `ONLINE` → create payment intent (placeholder for Razorpay/Stripe)
    - If `COD` → skip gateway
11. **Clear cart** after successful order creation
12. **Return response** with orderIds and payment info

### Success Response

**Status Code:** `200 OK`

#### For ONLINE Payment

```json
{
  "success": true,
  "message": "Checkout initiated successfully",
  "paymentRequired": true,
  "totalAmount": 1999.98,
  "orderIds": [
    "694129c27f75e93fd924715d",
    "694129c27f75e93fd924715e"
  ],
  "orders": [
    {
      "orderId": "694129c27f75e93fd924715d",
      "orderNumber": "ORD-1704067200000-1234",
      "vendorId": "693fbef1493989b8b80a31a6",
      "payableAmount": 999.99,
      "orderStatus": "PENDING",
      "paymentStatus": "PENDING"
    },
    {
      "orderId": "694129c27f75e93fd924715e",
      "orderNumber": "ORD-1704067200001-5678",
      "vendorId": "693fbef1493989b8b80a31a7",
      "payableAmount": 999.99,
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
  "totalAmount": 1999.98,
  "orderIds": [
    "694129c27f75e93fd924715d",
    "694129c27f75e93fd924715e"
  ],
  "orders": [
    {
      "orderId": "694129c27f75e93fd924715d",
      "orderNumber": "ORD-1704067200000-1234",
      "vendorId": "693fbef1493989b8b80a31a6",
      "payableAmount": 999.99,
      "orderStatus": "PENDING",
      "paymentStatus": "PENDING"
    }
  ],
  "paymentInfo": null
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `paymentRequired` | Boolean | Whether payment is required (true for ONLINE) |
| `totalAmount` | Number | Grand total of all orders |
| `orderIds` | Array | Array of order IDs created |
| `orders` | Array | Array of order details |
| `paymentInfo` | Object | Payment information (null for COD) |

#### Order Object

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | String | Order ID (MongoDB ObjectId) |
| `orderNumber` | String | Unique order number (e.g., ORD-1704067200000-1234) |
| `vendorId` | String | Vendor ID |
| `payableAmount` | Number | Amount to be paid for this order |
| `orderStatus` | String | Order status (PENDING) |
| `paymentStatus` | String | Payment status (PENDING) |

### Error Responses

#### Missing Payment Method
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Payment method must be either ONLINE or COD"
}
```

#### Empty Cart
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Cart is empty"
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

#### Invalid Coupon
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid or expired coupon code"
}
```

#### Coupon Usage Limit Exceeded
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Coupon usage limit exceeded"
}
```

#### Product Not Available
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Product iPhone 15 Pro is not available"
}
```

#### Insufficient Stock
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Insufficient stock for iPhone 15 Pro. Available: 5, Requested: 10"
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

1. **Transaction Safety:** All operations (stock deduction, order creation, coupon update) are performed within a MongoDB transaction for atomicity
2. **Stock Validation:** Stock is rechecked at checkout time to prevent race conditions
3. **Price Snapshot:** Product prices from cart are used (snapshot at add-to-cart time)
4. **Vendor-Wise Split:** Each vendor gets a separate order for easy order management
5. **Cart Clearing:** Cart is automatically cleared after successful checkout
6. **Coupon Application:** Coupons can be platform-wide or vendor-specific
7. **Payment Gateway:** ONLINE payment integration is placeholder (ready for Razorpay/Stripe)

---

## Database Schema

### Order Model

```javascript
{
  orderNumber: String,        // Unique order number (e.g., ORD-1704067200000-1234)
  userId: ObjectId,            // Reference to Customer
  vendorId: ObjectId,          // Reference to Vendor
  items: [
    {
      productId: ObjectId,     // Reference to Product
      name: String,             // Product name snapshot
      price: Number,           // Price snapshot
      quantity: Number,        // Quantity ordered
      total: Number            // price * quantity
    }
  ],
  subTotal: Number,           // Sum of all items
  discount: Number,           // Discount amount (from coupon)
  payableAmount: Number,      // Final amount to pay (subTotal - discount)
  orderStatus: String,        // PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
  paymentStatus: String,      // PENDING, PAID, FAILED, REFUNDED
  paymentMethod: String,      // ONLINE or COD
  paymentIntentId: String,    // Payment gateway intent ID (for ONLINE)
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  couponCode: String,         // Applied coupon code
  couponDiscount: Number,     // Discount from coupon
  createdAt: Date,
  updatedAt: Date
}
```

### Coupon Model

```javascript
{
  code: String,               // Unique coupon code (uppercase)
  description: String,        // Coupon description
  discountType: String,        // PERCENTAGE or FIXED
  discountValue: Number,       // Discount value
  minPurchaseAmount: Number,  // Minimum purchase amount required
  maxDiscountAmount: Number,  // Maximum discount (for percentage)
  applicableTo: String,       // PLATFORM, VENDOR, or ALL
  vendorId: ObjectId,         // Vendor ID (if applicableTo is VENDOR)
  validFrom: Date,            // Coupon validity start date
  validUntil: Date,           // Coupon validity end date
  usageLimit: Number,         // Maximum usage count
  usedCount: Number,          // Current usage count
  isActive: Boolean,           // Whether coupon is active
  createdAt: Date,
  updatedAt: Date
}
```

---

## Security & Best Practices

### Security

1. **Transaction Safety:** All operations use MongoDB transactions for atomicity
2. **Stock Revalidation:** Stock is checked again at checkout to prevent race conditions
3. **Price Snapshot:** Uses cart prices (snapshot) to prevent price manipulation
4. **Authentication Required:** Only authenticated customers can checkout
5. **User Isolation:** Customers can only checkout their own cart

### Best Practices

1. **Atomic Operations:** Stock deduction and order creation happen in a single transaction
2. **Stock Validation:** Rechecks stock at checkout time (not just at add-to-cart)
3. **Price Consistency:** Uses price snapshot from cart
4. **Error Handling:** Comprehensive error messages for debugging
5. **Transaction Rollback:** If any step fails, all changes are rolled back
6. **Coupon Validation:** Strict validation of coupon codes (active, not expired, within limits)
7. **Vendor Split:** Automatic vendor-wise order splitting for easy management

### Performance

1. **Indexes:** Order model has indexes on `orderNumber`, `userId`, `vendorId`, `orderStatus`, and `paymentStatus`
2. **Transactions:** Uses MongoDB sessions for efficient transaction handling
3. **Bulk Operations:** Uses `insertMany` for creating multiple orders efficiently

---

## Coupon System

### Coupon Types

1. **PERCENTAGE:** Discount is a percentage of the order amount
   - Example: 10% off with max discount of $50
2. **FIXED:** Fixed amount discount
   - Example: $20 off

### Coupon Applicability

1. **PLATFORM:** Applies to all vendors (platform-wide)
2. **VENDOR:** Applies only to specific vendor
3. **ALL:** Applies to all orders regardless of vendor

### Coupon Validation

- Must be active (`isActive: true`)
- Must be within validity period (`validFrom <= now <= validUntil`)
- Must not exceed usage limit (`usedCount < usageLimit`)
- Must meet minimum purchase amount (if specified)

### Coupon Application Logic

1. Check if coupon is valid (active, not expired, within usage limit)
2. Check if order amount meets minimum purchase requirement
3. Calculate discount based on `discountType`:
   - **PERCENTAGE:** `(amount * discountValue) / 100` (capped at `maxDiscountAmount` if specified)
   - **FIXED:** `min(discountValue, amount)`
4. Apply discount to vendor subtotal (if coupon is applicable to that vendor)
5. Update coupon `usedCount` after successful checkout

---

## Payment Methods

### ONLINE Payment

- Payment gateway integration placeholder (ready for Razorpay/Stripe)
- `paymentIntentId` will be generated by payment gateway
- `paymentUrl` will be provided for redirect
- Order status remains `PENDING` until payment is confirmed

### COD (Cash on Delivery)

- No payment gateway required
- Payment collected at delivery
- Order status can be updated to `CONFIRMED` immediately
- `paymentStatus` remains `PENDING` until delivery confirmation

---

## Example Use Cases

### 1. Basic Checkout (COD)

```bash
POST /api/orders/checkout
{
  "paymentMethod": "COD"
}
```

### 2. Checkout with Coupon (ONLINE)

```bash
POST /api/orders/checkout
{
  "couponCode": "SAVE10",
  "paymentMethod": "ONLINE"
}
```

### 3. Multi-Vendor Checkout

If cart contains items from multiple vendors:
- Automatically creates separate orders for each vendor
- Each order has its own order number
- Each order can have different coupon discounts (if vendor-specific)

---

## Future Enhancements

1. **Payment Gateway Integration:** Integrate Razorpay/Stripe for ONLINE payments
2. **Payment Verification:** Webhook endpoint for payment confirmation
3. **Order Status Updates:** APIs to update order status (CONFIRMED, SHIPPED, DELIVERED)
4. **Order History:** API to fetch customer's order history
5. **Order Details:** API to fetch detailed order information
6. **Order Cancellation:** API to cancel pending orders
7. **Multiple Addresses:** Support for multiple shipping addresses
8. **Order Tracking:** Real-time order tracking functionality
9. **Refund Processing:** Handle refunds for cancelled/failed orders
10. **Email Notifications:** Send order confirmation emails

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
- `400` - Bad Request (validation errors, insufficient stock, invalid coupon)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (role/permission denied)
- `404` - Not Found (customer not found)
- `500` - Internal Server Error (server errors, transaction failures)

---

## Transaction Flow Diagram

```
1. Start Transaction
   ↓
2. Fetch Cart
   ↓
3. Validate Products (active, stock)
   ↓
4. Validate Coupon (if provided)
   ↓
5. Create Orders (vendor-wise)
   ↓
6. Deduct Stock
   ↓
7. Update Coupon Usage
   ↓
8. Clear Cart
   ↓
9. Commit Transaction
   ↓
10. Return Response
```

If any step fails:
- **Abort Transaction** (rollback all changes)
- **Return Error Response**

---

## Testing Checklist

- [ ] Empty cart validation
- [ ] Product not found validation
- [ ] Product inactive validation
- [ ] Insufficient stock validation
- [ ] Valid coupon application
- [ ] Invalid coupon rejection
- [ ] Expired coupon rejection
- [ ] Coupon usage limit validation
- [ ] Multi-vendor order splitting
- [ ] Stock deduction accuracy
- [ ] Cart clearing after checkout
- [ ] Transaction rollback on error
- [ ] ONLINE payment flow
- [ ] COD payment flow

