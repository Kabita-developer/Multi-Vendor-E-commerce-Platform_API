# Payment Processing API Documentation

## Overview

This document describes the Payment Processing APIs for customers. These APIs handle payment creation, verification, and Cash on Delivery (COD) confirmation for multi-vendor orders.

**Base URL:** `/api/payment`

**Authentication:** All payment endpoints require JWT authentication with customer role.

**Payment Gateways Supported:**
- Razorpay (default)
- Stripe
- COD (Cash on Delivery)

---

## CREATE PAYMENT

### Endpoint

`POST /api/payment/create`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can create payments
- Orders must belong to the logged-in user
- All orders must have `paymentStatus = PENDING`
- All orders must have `paymentMethod = ONLINE`
- Amount must match sum of order payable amounts

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderIds` | Array[String] | Yes | Array of order IDs to pay for |
| `amount` | Number | Yes | Total amount to pay (must match sum of orders) |
| `currency` | String | No | Currency code (default: "INR") |

### Request Example

```json
{
  "orderIds": [
    "694129c27f75e93fd924715d",
    "694129c27f75e93fd924715e"
  ],
  "amount": 1999.98,
  "currency": "INR"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/payment/create \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderIds": ["694129c27f75e93fd924715d"],
    "amount": 999.99,
    "currency": "INR"
  }'
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Validate `orderIds` (non-empty array, valid ObjectIds)
3. Validate `amount` (positive number)
4. Fetch orders and validate:
   - All orders belong to logged-in user
   - All orders have `paymentStatus = PENDING`
   - All orders have `paymentMethod = ONLINE`
5. Calculate total amount from orders
6. Validate amount matches (allow small rounding differences)
7. Create payment order with gateway (Razorpay/Stripe)
8. Save payment record in database
9. Update orders with payment reference (`paymentIntentId`)
10. Return payment details to frontend

### Success Response

**Status Code:** `200 OK`

#### For Razorpay

```json
{
  "success": true,
  "paymentId": "pay_1704067200000_abc123",
  "gatewayOrderId": "order_1704067200000_xyz789",
  "amount": 1999.98,
  "currency": "INR",
  "keyId": "rzp_test_xxxxxxxxxxxxx"
}
```

#### For Stripe

```json
{
  "success": true,
  "paymentId": "pay_1704067200000_abc123",
  "gatewayOrderId": "pi_1704067200000_xyz789",
  "amount": 1999.98,
  "currency": "INR",
  "clientSecret": "pi_xxxxx_secret_xxxxx"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `paymentId` | String | Internal payment ID |
| `gatewayOrderId` | String | Payment gateway order/intent ID |
| `amount` | Number | Payment amount |
| `currency` | String | Currency code |
| `keyId` | String | Razorpay key ID (for Razorpay only) |
| `clientSecret` | String | Stripe client secret (for Stripe only) |

### Error Responses

#### Missing Order IDs
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Order IDs are required and must be a non-empty array"
}
```

#### Invalid Amount
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Amount is required and must be a positive number"
}
```

#### Orders Not Found
**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "Some orders not found or do not belong to you"
}
```

#### Orders Already Processed
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Some orders are already processed or cancelled"
}
```

#### Amount Mismatch
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Amount mismatch. Expected: 1999.98, Provided: 2000.00"
}
```

#### Payment Gateway Error
**Status Code:** `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Failed to create payment order with gateway"
}
```

### Notes

1. **Payment Gateway:** Configured via `PAYMENT_GATEWAY` environment variable (RAZORPAY or STRIPE)
2. **Amount Validation:** Amount must match sum of order payable amounts (within 0.01 tolerance)
3. **Payment Record:** Payment record is created in database for tracking
4. **Order Update:** Orders are updated with `paymentIntentId` for reference

---

## VERIFY PAYMENT

### Endpoint

`POST /api/payment/verify`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can verify payments
- Payment must belong to logged-in user
- Signature verification is mandatory
- Idempotent operation (can be called multiple times safely)

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paymentId` | String | Yes | Internal payment ID |
| `gatewayOrderId` | String | Yes | Payment gateway order/intent ID |
| `signature` | String | Yes | Payment signature from gateway |
| `orderIds` | Array[String] | Yes | Array of order IDs to verify |

### Request Example

```json
{
  "paymentId": "pay_1704067200000_abc123",
  "gatewayOrderId": "order_1704067200000_xyz789",
  "signature": "abc123def456...",
  "orderIds": [
    "694129c27f75e93fd924715d",
    "694129c27f75e93fd924715e"
  ]
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/payment/verify \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "pay_1704067200000_abc123",
    "gatewayOrderId": "order_1704067200000_xyz789",
    "signature": "abc123def456...",
    "orderIds": ["694129c27f75e93fd924715d"]
  }'
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Validate required fields (`paymentId`, `gatewayOrderId`, `signature`, `orderIds`)
3. Fetch payment record and validate ownership
4. Check if already verified (idempotent check)
5. Verify payment signature using gateway secret
6. If verification fails:
   - Update orders: `paymentStatus = FAILED`, `orderStatus = CANCELLED`
   - Rollback product stock (add back quantity)
   - Update payment: `paymentStatus = FAILED`
   - Return error response
7. If verification succeeds:
   - Update orders: `paymentStatus = PAID`, `orderStatus = CONFIRMED`
   - Update payment: `paymentStatus = PAID`, save signature and verifiedAt
   - Return success response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Payment verified successfully",
  "ordersConfirmed": [
    {
      "orderId": "694129c27f75e93fd924715d",
      "orderNumber": "ORD-1704067200000-1234",
      "orderStatus": "CONFIRMED",
      "paymentStatus": "PAID"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `ordersConfirmed` | Array | Array of confirmed orders |

#### Order Confirmed Object

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | String | Order ID |
| `orderNumber` | String | Order number |
| `orderStatus` | String | Order status (CONFIRMED) |
| `paymentStatus` | String | Payment status (PAID) |

### Error Responses

#### Missing Required Fields
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Payment ID, Gateway Order ID, and Signature are required"
}
```

#### Payment Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Payment not found"
}
```

#### Payment Already Verified
**Status Code:** `200 OK` (Idempotent)

```json
{
  "success": true,
  "message": "Payment already verified",
  "ordersConfirmed": [...]
}
```

#### Signature Verification Failed
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Payment verification failed. Orders cancelled and stock restored."
}
```

### Notes

1. **Idempotent:** Can be called multiple times safely (returns success if already verified)
2. **Stock Rollback:** On failure, product stock is automatically restored
3. **Signature Verification:** Uses HMAC SHA256 for Razorpay, gateway-specific for Stripe
4. **Transaction Safety:** All operations use MongoDB transactions
5. **Never Trust Frontend:** Always verify signature server-side

---

## CASH ON DELIVERY (COD)

### Endpoint

`POST /api/payment/cod`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can confirm COD
- Orders must belong to logged-in user
- All orders must have `paymentMethod = COD`
- Orders must be in PENDING status

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderIds` | Array[String] | Yes | Array of order IDs to confirm |

### Request Example

```json
{
  "orderIds": [
    "694129c27f75e93fd924715d",
    "694129c27f75e93fd924715e"
  ]
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/payment/cod \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderIds": ["694129c27f75e93fd924715d"]
  }'
```

### Controller Logic

1. Verify JWT token and ensure role === "customer"
2. Validate `orderIds` (non-empty array, valid ObjectIds)
3. Fetch orders and validate ownership
4. Validate all orders have `paymentMethod = COD`
5. Validate orders are in PENDING status
6. Update orders:
   - `paymentMethod = "COD"`
   - `paymentStatus = "PENDING"` (will be updated to PAID on delivery)
   - `orderStatus = "CONFIRMED"`
7. Return success response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Order placed with Cash on Delivery",
  "ordersConfirmed": [
    {
      "orderId": "694129c27f75e93fd924715d",
      "orderNumber": "ORD-1704067200000-1234",
      "orderStatus": "CONFIRMED",
      "paymentStatus": "PENDING",
      "paymentMethod": "COD"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `ordersConfirmed` | Array | Array of confirmed orders |

#### Order Confirmed Object

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | String | Order ID |
| `orderNumber` | String | Order number |
| `orderStatus` | String | Order status (CONFIRMED) |
| `paymentStatus` | String | Payment status (PENDING) |
| `paymentMethod` | String | Payment method (COD) |

### Error Responses

#### Missing Order IDs
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Order IDs are required and must be a non-empty array"
}
```

#### Orders Not Found
**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "Some orders not found or do not belong to you"
}
```

#### Invalid Payment Method
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "All orders must have payment method COD"
}
```

#### Orders Already Processed
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Some orders are already processed"
}
```

### Notes

1. **No Payment Gateway:** COD doesn't require payment gateway integration
2. **Payment Status:** Remains PENDING until delivery confirmation
3. **Order Status:** Immediately set to CONFIRMED
4. **Stock Already Deducted:** Stock was deducted during checkout

---

## Database Schema

### Payment Model

```javascript
{
  paymentId: String,           // Unique payment ID (e.g., pay_1704067200000_abc123)
  gatewayOrderId: String,      // Gateway order/intent ID
  userId: ObjectId,            // Reference to Customer
  orderIds: [ObjectId],         // Array of order references
  amount: Number,              // Payment amount
  currency: String,            // Currency code (INR, USD, etc.)
  paymentMethod: String,       // ONLINE or COD
  paymentStatus: String,       // PENDING, PAID, FAILED, REFUNDED
  gateway: String,             // RAZORPAY, STRIPE, or COD
  signature: String,            // Payment signature (for verification)
  metadata: Object,             // Additional gateway-specific data
  verifiedAt: Date,            // Payment verification timestamp
  failureReason: String,        // Reason for failure (if failed)
  createdAt: Date,
  updatedAt: Date
}
```

---

## Payment Gateway Integration

### Razorpay

#### Setup

1. Install Razorpay SDK:
   ```bash
   npm install razorpay
   ```

2. Set environment variables:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_secret_key
   PAYMENT_GATEWAY=RAZORPAY
   ```

3. Update `Payment_Processing/services/paymentGateway.js`:
   - Uncomment Razorpay SDK code
   - Replace placeholder implementation

#### Signature Verification

Razorpay signature is HMAC SHA256 of `gatewayOrderId|paymentId` using `RAZORPAY_KEY_SECRET`.

### Stripe

#### Setup

1. Install Stripe SDK:
   ```bash
   npm install stripe
   ```

2. Set environment variables:
   ```
   STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
   PAYMENT_GATEWAY=STRIPE
   ```

3. Update `Payment_Processing/services/paymentGateway.js`:
   - Uncomment Stripe SDK code
   - Replace placeholder implementation

#### Signature Verification

Stripe uses webhook signatures for verification. For payment intent verification, check payment status via Stripe API.

---

## Security & Best Practices

### Security

1. **Signature Verification:** Always verify payment signatures server-side
2. **Never Trust Frontend:** Payment status from frontend is never trusted
3. **Transaction Safety:** All operations use MongoDB transactions
4. **User Isolation:** Customers can only access their own payments
5. **Idempotent Operations:** Verify API is idempotent (safe to retry)

### Best Practices

1. **Stock Rollback:** Automatically rollback stock on payment failure
2. **Error Handling:** Comprehensive error messages for debugging
3. **Transaction Rollback:** If any step fails, all changes are rolled back
4. **Amount Validation:** Always validate amount matches order totals
5. **Status Validation:** Check order status before processing
6. **Multiple Orders:** Support multiple orders in single payment

### Performance

1. **Indexes:** Payment model has indexes on `paymentId`, `gatewayOrderId`, `userId`, and `paymentStatus`
2. **Transactions:** Uses MongoDB sessions for efficient transaction handling
3. **Bulk Operations:** Updates multiple orders efficiently

---

## Payment Flow Diagrams

### ONLINE Payment Flow

```
1. Customer completes checkout
   ↓
2. Orders created (paymentStatus: PENDING)
   ↓
3. Call POST /api/payment/create
   ↓
4. Payment order created with gateway
   ↓
5. Payment record saved
   ↓
6. Frontend redirects to payment gateway
   ↓
7. Customer completes payment on gateway
   ↓
8. Gateway redirects back with signature
   ↓
9. Call POST /api/payment/verify
   ↓
10. Signature verified
    ↓
11. Orders updated (paymentStatus: PAID, orderStatus: CONFIRMED)
```

### COD Payment Flow

```
1. Customer completes checkout (paymentMethod: COD)
   ↓
2. Orders created (paymentStatus: PENDING, orderStatus: PENDING)
   ↓
3. Call POST /api/payment/cod
   ↓
4. Orders updated (orderStatus: CONFIRMED, paymentStatus: PENDING)
   ↓
5. Order ready for processing
```

### Payment Failure Flow

```
1. Payment verification fails
   ↓
2. Orders updated (paymentStatus: FAILED, orderStatus: CANCELLED)
   ↓
3. Stock rolled back (quantity added back)
   ↓
4. Payment record updated (paymentStatus: FAILED)
   ↓
5. Error response returned
```

---

## Example Use Cases

### 1. Create Payment for Single Order

```bash
POST /api/payment/create
{
  "orderIds": ["694129c27f75e93fd924715d"],
  "amount": 999.99,
  "currency": "INR"
}
```

### 2. Create Payment for Multiple Orders

```bash
POST /api/payment/create
{
  "orderIds": [
    "694129c27f75e93fd924715d",
    "694129c27f75e93fd924715e"
  ],
  "amount": 1999.98,
  "currency": "INR"
}
```

### 3. Verify Payment

```bash
POST /api/payment/verify
{
  "paymentId": "pay_1704067200000_abc123",
  "gatewayOrderId": "order_1704067200000_xyz789",
  "signature": "abc123def456...",
  "orderIds": ["694129c27f75e93fd924715d"]
}
```

### 4. Confirm COD

```bash
POST /api/payment/cod
{
  "orderIds": ["694129c27f75e93fd924715d"]
}
```

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
- `400` - Bad Request (validation errors, signature verification failed)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (order ownership denied)
- `404` - Not Found (payment/order not found)
- `500` - Internal Server Error (server errors, gateway errors)

---

## Testing Checklist

- [ ] Create payment with valid orders
- [ ] Create payment with invalid order IDs
- [ ] Create payment with amount mismatch
- [ ] Create payment with already processed orders
- [ ] Verify payment with valid signature
- [ ] Verify payment with invalid signature
- [ ] Verify payment idempotency (multiple calls)
- [ ] Verify payment failure (stock rollback)
- [ ] COD confirmation with valid orders
- [ ] COD confirmation with invalid payment method
- [ ] Transaction rollback on errors
- [ ] Multiple orders in single payment

---

## Future Enhancements

1. **Webhook Support:** Add webhook endpoints for payment gateway callbacks
2. **Refund Processing:** Handle refunds for cancelled/failed orders
3. **Payment History:** API to fetch customer's payment history
4. **Payment Status Check:** API to check payment status without verification
5. **Partial Payments:** Support partial payments for multiple orders
6. **Payment Retry:** Allow retrying failed payments
7. **Payment Notifications:** Send email/SMS notifications on payment success/failure
8. **Analytics:** Payment analytics and reporting

