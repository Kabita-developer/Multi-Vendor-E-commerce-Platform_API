# Customer Order Cancel, Return and Refund System API Documentation

## Overview

This document describes the Customer Order Cancel, Return and Refund System for a Multi-Vendor E-commerce Platform. This system allows customers to cancel orders before shipment, return products after delivery, and receive refunds based on business rules similar to Amazon/Flipkart.

**Base URLs:**
- Customer: `/api/orders`
- Admin: `/api/admin`

**Authentication:** All endpoints require JWT authentication with appropriate role.

---

## ORDER STATUS RULES

### Order Lifecycle

```
PENDING → CONFIRMED → PACKED → SHIPPED → DELIVERED
```

### Cancellation Rules

**Cancel Allowed When:**
- `PENDING`
- `CONFIRMED`

**Cancel NOT Allowed When:**
- `PACKED`
- `SHIPPED`
- `DELIVERED`

**Admin Override:** Admin can cancel orders at any stage.

### Return Rules

**Return Allowed When:**
- Order status = `DELIVERED`
- Within return window (7 days from delivery)
- Product is returnable

**Return Types:**
- `refund` - Customer wants money back
- `replacement` - Customer wants product replacement

### Refund Rules

**COD Orders:**
- Cancel before delivery → No refund required
- Return after delivery → Refund after pickup

**Online Payment Orders:**
- Cancel before shipment → Refund initiated immediately
- Return after delivery → Refund after pickup completion

**Refund Status:**
- `NOT_REQUIRED` - No refund needed (COD cancellation)
- `PENDING` - Refund initiated, processing
- `COMPLETED` - Refund completed
- `FAILED` - Refund failed

---

# CUSTOMER ENDPOINTS

## CANCEL ORDER

### Endpoint

`POST /api/orders/:id/cancel`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | String | No | Cancellation reason |

### Request Example

```json
{
  "reason": "Changed my mind"
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "status": "CANCELLED",
    "refundStatus": "PENDING",
    "refundAmount": 1500.00
  }
}
```

### Error Responses

#### Order Not Found

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Order not found"
}
```

#### Cannot Cancel Order

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Order cannot be cancelled. Current status: SHIPPED. Orders can only be cancelled before shipment (PENDING or CONFIRMED status)."
}
```

#### Already Cancelled

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Order is already cancelled"
}
```

### Business Logic

1. Validates order ownership
2. Validates order status (must be PENDING or CONFIRMED)
3. Rolls back product stock
4. Updates order status to CANCELLED
5. For online payments: Sets refund status to PENDING and initiates refund
6. Reverses vendor commission if already credited

---

## REQUEST RETURN

### Endpoint

`POST /api/orders/:id/return`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | String | Yes | Return reason |
| `returnType` | String | No | `refund` or `replacement` (default: `refund`) |

### Request Example

```json
{
  "reason": "Product damaged",
  "returnType": "refund"
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Return request submitted successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "returnStatus": "REQUESTED",
    "returnType": "refund"
  }
}
```

### Error Responses

#### Order Not Delivered

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Order cannot be returned. Current status: SHIPPED. Only DELIVERED orders can be returned."
}
```

#### Return Window Expired

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Return window has expired. Orders can only be returned within 7 days of delivery."
}
```

#### Return Already Requested

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Return request already exists for this order"
}
```

### Business Logic

1. Validates order ownership
2. Validates order status (must be DELIVERED)
3. Validates return window (7 days from delivery)
4. Sets return status to REQUESTED
5. Waits for admin approval

---

## REQUEST REFUND

### Endpoint

`POST /api/orders/:id/request-refund`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | String | No | Refund reason |

### Request Example

```json
{
  "reason": "Order cancelled but refund not processed"
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Refund request submitted successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "refundStatus": "PENDING",
    "refundAmount": 1500.00
  }
}
```

### Error Responses

#### Order Not Found

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Order not found"
}
```

#### COD Order

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "COD orders do not require refund as payment was not received. If you need assistance, please contact support."
}
```

#### Payment Not Made

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Refund cannot be requested. Payment status is PENDING. Only paid orders are eligible for refund."
}
```

#### Refund Already Completed

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Refund has already been completed for this order."
}
```

#### Refund Already Pending

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Refund request already exists and is being processed."
}
```

#### Delivered Order

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "For delivered orders, please use the return request API first. Refunds are processed after return approval and pickup completion."
}
```

### Business Logic

1. Validates order ownership
2. Validates payment method (only online payments eligible)
3. Validates payment status (must be PAID)
4. Validates order status (CANCELLED orders eligible for direct refund)
5. For DELIVERED orders, redirects to return process
6. Sets refund status to PENDING
7. Initiates refund through payment gateway
8. Allows retry for failed refunds

### Eligibility Rules

**Eligible for Direct Refund Request:**
- Online payment orders
- Payment status = PAID
- Order status = CANCELLED (refund not yet initiated)
- Refund status = NOT_REQUIRED or FAILED

**Not Eligible:**
- COD orders (no payment received)
- Unpaid orders
- Already completed refunds
- DELIVERED orders (must use return process)

---

## GET REFUND STATUS

### Endpoint

`GET /api/orders/:id/refund-status`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Example

```bash
curl -X GET "http://localhost:3000/api/orders/694129c27f75e93fd924715d/refund-status" \
  -H "Authorization: Bearer <jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "refundStatus": "PENDING",
    "refundAmount": 1500.00,
    "refundInitiatedAt": "2024-01-15T10:30:00.000Z",
    "refundCompletedAt": null,
    "refundReference": "REF-1234567890-ABC",
    "refundFailureReason": null,
    "paymentMethod": "ONLINE",
    "paymentStatus": "PAID"
  }
}
```

---

# ADMIN ENDPOINTS

## APPROVE ORDER CANCELLATION

### Endpoint

`POST /api/admin/orders/:id/approve-cancel`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | String | No | Cancellation reason |

### Request Example

```json
{
  "reason": "Customer request - Admin override"
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "status": "CANCELLED",
    "refundStatus": "PENDING",
    "refundAmount": 1500.00
  }
}
```

### Business Logic

1. Admin can cancel orders at any stage (override)
2. Rolls back product stock
3. Updates order status to CANCELLED
4. Initiates refund for online payments
5. Reverses vendor commission

---

## APPROVE RETURN REQUEST

### Endpoint

`POST /api/admin/orders/:id/approve-return`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Example

```bash
curl -X POST "http://localhost:3000/api/admin/orders/694129c27f75e93fd924715d/approve-return" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Return request approved successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "returnStatus": "APPROVED",
    "returnType": "refund"
  }
}
```

### Business Logic

1. Validates return request exists
2. Updates return status to APPROVED
3. Schedules pickup (manual process)

---

## MARK PICKUP COMPLETED

### Endpoint

`POST /api/admin/orders/:id/pickup-completed`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Example

```bash
curl -X POST "http://localhost:3000/api/admin/orders/694129c27f75e93fd924715d/pickup-completed" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Pickup completed successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "returnStatus": "PICKUP_COMPLETED",
    "refundStatus": "PENDING",
    "refundAmount": 1500.00
  }
}
```

### Business Logic

1. Validates return is approved
2. Updates return status to PICKUP_COMPLETED
3. If return type is refund, initiates refund
4. Reverses vendor commission

---

## COMPLETE RETURN

### Endpoint

`POST /api/admin/orders/:id/complete-return`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Example

```bash
curl -X POST "http://localhost:3000/api/admin/orders/694129c27f75e93fd924715d/complete-return" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Return completed successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "returnStatus": "COMPLETED",
    "orderStatus": "RETURNED"
  }
}
```

---

## INITIATE REFUND

### Endpoint

`POST /api/admin/refunds/:orderId/initiate`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | Number | No | Refund amount (default: order payable amount) |

### Request Example

```json
{
  "amount": 1500.00
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Refund initiated successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "refundStatus": "PENDING",
    "refundAmount": 1500.00,
    "refundReference": "REF-1234567890-ABC"
  }
}
```

### Business Logic

1. Validates order has online payment
2. Validates payment status is PAID
3. Initiates refund through payment gateway
4. Updates order refund status to PENDING

---

## COMPLETE REFUND

### Endpoint

`POST /api/admin/refunds/:orderId/complete`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refundReference` | String | No | Payment gateway refund reference |

### Request Example

```json
{
  "refundReference": "REF-1234567890-ABC"
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Refund completed successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1234567890-1234",
    "refundStatus": "COMPLETED",
    "refundAmount": 1500.00,
    "refundReference": "REF-1234567890-ABC"
  }
}
```

---

## Database Schema Updates

### Order Model (New Fields)

```javascript
{
  // ... existing fields ...
  
  // Cancellation fields
  cancelReason: String,
  cancelledAt: Date,
  cancelledBy: String,        // "customer" | "admin" | "super-admin"
  cancelledByUserId: ObjectId,
  
  // Return fields
  returnReason: String,
  returnType: String,          // "refund" | "replacement"
  returnStatus: String,        // "REQUESTED" | "APPROVED" | "PICKUP_COMPLETED" | "COMPLETED" | "REJECTED"
  returnRequestedAt: Date,
  returnApprovedAt: Date,
  returnApprovedBy: ObjectId,
  pickupCompletedAt: Date,
  returnCompletedAt: Date,
  
  // Refund fields
  refundStatus: String,        // "NOT_REQUIRED" | "PENDING" | "COMPLETED" | "FAILED"
  refundAmount: Number,
  refundInitiatedAt: Date,
  refundCompletedAt: Date,
  refundReference: String,
  refundFailureReason: String,
  
  // Updated orderStatus enum
  orderStatus: String,         // Added "RETURNED" to enum
}
```

---

## Business Rules Summary

### Cancellation Flow

1. **Customer Request:**
   - Validates order status (PENDING or CONFIRMED)
   - Rolls back stock
   - Updates status to CANCELLED
   - Initiates refund for online payments
   - Reverses commission

2. **Admin Override:**
   - Can cancel at any stage
   - Same process as customer cancellation

### Return Flow

1. **Customer Request:**
   - Validates DELIVERED status
   - Validates return window (7 days)
   - Sets return status to REQUESTED

2. **Admin Approval:**
   - Approves return request
   - Sets return status to APPROVED

3. **Pickup Completion:**
   - Admin marks pickup as completed
   - Sets return status to PICKUP_COMPLETED
   - If refund type, initiates refund
   - Reverses commission

4. **Return Completion:**
   - Admin marks return as completed
   - Sets return status to COMPLETED
   - Updates order status to RETURNED

### Refund Flow

1. **Automatic (Cancel/Return):**
   - For online payments, refund initiated automatically
   - Refund status set to PENDING

2. **Manual (Admin):**
   - Admin can manually initiate refund
   - Admin can complete refund after gateway confirmation

### Commission Reversal

- When order is cancelled or returned:
  - If commission was credited, it's reversed
  - Vendor wallet is debited
  - Transaction is logged

---

## Security & Best Practices

1. **JWT Authentication:** All endpoints require valid JWT token
2. **Role-Based Access:** Customer can only access own orders
3. **Status Validation:** Strict validation of order status transitions
4. **Stock Management:** Automatic stock rollback on cancellation
5. **Commission Handling:** Proper reversal of commission on cancel/return
6. **Refund Safety:** Refunds only for online payments
7. **Transaction Safety:** Uses MongoDB transactions for critical operations
8. **Idempotency:** Prevents double processing

---

## Example Use Cases

### Use Case 1: Customer Cancels Order Before Shipment

1. Customer calls `POST /api/orders/:id/cancel`
2. System validates order is PENDING or CONFIRMED
3. Stock is rolled back
4. Order status updated to CANCELLED
5. For online payment: Refund initiated
6. Commission reversed if credited

### Use Case 2: Customer Returns Delivered Product

1. Customer calls `POST /api/orders/:id/return` with reason
2. System validates order is DELIVERED and within 7 days
3. Return status set to REQUESTED
4. Admin approves return
5. Pickup scheduled and completed
6. Refund initiated (if refund type)
7. Return marked as completed

### Use Case 3: Admin Override Cancellation

1. Admin calls `POST /api/admin/orders/:id/approve-cancel`
2. System cancels order regardless of status
3. Stock rolled back
4. Refund initiated if applicable
5. Commission reversed

---

## Future Enhancements

1. **Partial Refunds:** Support partial refunds for partial returns
2. **Return Labels:** Generate return shipping labels
3. **Email Notifications:** Send emails on cancel/return status changes
4. **Return Tracking:** Track return shipment status
5. **Refund Webhooks:** Handle payment gateway refund webhooks
6. **Return Analytics:** Dashboard for return/cancel analytics
7. **Auto-Approval:** Auto-approve returns within certain conditions
8. **Return Reasons Analytics:** Track common return reasons

---

## Support

For issues or questions, please contact the development team or refer to the main API documentation.

