# Order Fulfillment API Documentation

## Overview

This document describes the Order Fulfillment API for vendors, admins, and super-admins. This API allows updating order status with proper validation and automatic wallet credit on delivery.

**Base URL:** `/api/vendor/orders`

**Authentication:** All endpoints require JWT authentication with vendor, admin, or super-admin role.

---

## UPDATE ORDER STATUS

### Endpoint

`POST /api/vendor/orders/:id/status`

### Authentication

- **Required:** Yes (JWT Token)
- **Roles:** Vendor, Admin, Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- **Vendor:** Can only update their own orders
- **Admin/Super Admin:** Can update any order (override allowed)
- **Vendor Status Transitions:** Must follow sequence (cannot skip steps)
- **Admin Override:** Can set any status regardless of current status

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | String | Yes | New order status: `"PACKED"`, `"SHIPPED"`, or `"DELIVERED"` |

### Request Example

```json
{
  "status": "SHIPPED"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/vendor/orders/694129c27f75e93fd924715d/status \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SHIPPED"
  }'
```

### Controller Logic (Step by Step)

1. **Authenticate user** via JWT token
2. **Fetch order** by orderId
3. **If order not found** → return 404
4. **If role === vendor:**
   - Ensure `order.vendorId === user.vendorId`
   - Validate allowed status transition (cannot skip steps)
5. **If role === admin/superadmin:**
   - Skip transition validation (override allowed)
6. **Update order.orderStatus**
7. **Push status change** into statusHistory:
   ```json
   {
     "status": "SHIPPED",
     "updatedBy": "vendor",
     "updatedByUserId": "...",
     "updatedAt": "2024-01-15T10:30:00.000Z"
   }
   ```
8. **If status === "DELIVERED":**
   - Check `walletCredited` flag
   - Trigger vendor wallet credit logic
9. **Save order**
10. **Return success response**

### Status Transition Map

#### For Vendors (Sequential, Cannot Skip Steps)

| Current Status | Allowed Next Status |
|----------------|-------------------|
| PENDING | PACKED |
| CONFIRMED | PACKED |
| PACKED | SHIPPED |
| PROCESSING | SHIPPED |
| SHIPPED | DELIVERED |

#### For Admin/Super Admin (Override Allowed)

- Can set any status regardless of current status
- No transition validation

### Success Response

**Status Code:** `200 OK`

#### For Non-DELIVERED Status

```json
{
  "success": true,
  "message": "Order status updated successfully",
  "currentStatus": "SHIPPED",
  "previousStatus": "PACKED"
}
```

#### For DELIVERED Status

```json
{
  "success": true,
  "message": "Order status updated to DELIVERED successfully",
  "currentStatus": "DELIVERED",
  "previousStatus": "SHIPPED",
  "walletCredit": {
    "credited": true,
    "vendorAmount": 899.99,
    "walletBalance": 4500.50
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `currentStatus` | String | Updated order status |
| `previousStatus` | String | Previous order status |
| `walletCredit` | Object | Wallet credit info (only for DELIVERED status) |

#### Wallet Credit Object (DELIVERED only)

| Field | Type | Description |
|-------|------|-------------|
| `credited` | Boolean | Whether wallet was credited |
| `vendorAmount` | Number | Amount credited to wallet |
| `walletBalance` | Number | Updated wallet balance |

### Error Responses

#### Missing Status
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Status must be one of: PACKED, SHIPPED, DELIVERED"
}
```

#### Invalid Order ID
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid order ID format"
}
```

#### Order Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Order not found"
}
```

#### Unauthorized Access (Vendor)
**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "You are not authorized to update this order"
}
```

#### Invalid Status Transition (Vendor)
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid status transition. Cannot change from PACKED to DELIVERED. Allowed transitions: SHIPPED"
}
```

#### Commission Not Calculated (DELIVERED)
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Commission not calculated for this order. Commission must be calculated before marking as delivered."
}
```

#### Status Already Set
**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Order status is already SHIPPED",
  "currentStatus": "SHIPPED"
}
```

### Notes

1. **Status History:** All status changes are logged in `order.statusHistory` array
2. **Wallet Credit:** Automatically triggered when status becomes DELIVERED
3. **Idempotent:** Setting same status returns success (no error)
4. **Double Credit Prevention:** Wallet credit service prevents double credit
5. **Transaction Safety:** Uses MongoDB transactions for atomic operations

---

## Database Schema

### Order Model (Status History Field)

```javascript
{
  // ... other order fields
  orderStatus: String,  // PENDING, CONFIRMED, PACKED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
  statusHistory: [
    {
      status: String,        // Order status
      updatedBy: String,     // "vendor", "admin", or "super-admin"
      updatedByUserId: ObjectId,  // User who updated
      updatedAt: Date        // Update timestamp
    }
  ],
  commission: {
    // ... commission fields
    walletCredited: Boolean  // Whether wallet was credited
  }
}
```

---

## Business Rules

### Vendor Status Updates

1. **Sequential Updates:** Must follow sequence (PENDING → PACKED → SHIPPED → DELIVERED)
2. **Cannot Skip Steps:** Cannot jump from PACKED to DELIVERED
3. **Own Orders Only:** Can only update their own orders
4. **Status Validation:** Transition validated before update

### Admin/Super Admin Override

1. **Any Status:** Can set any status regardless of current status
2. **Any Order:** Can update any order (no ownership check)
3. **Override Allowed:** Bypasses transition validation

### Wallet Credit Trigger

1. **Automatic:** Triggered when status becomes DELIVERED
2. **Commission Required:** Commission must be calculated before delivery
3. **Double Credit Prevention:** Wallet credit service prevents duplicate credits
4. **Non-Blocking:** Wallet credit runs outside transaction (doesn't block status update)

---

## Status Transition Examples

### Example 1: Vendor Sequential Update

**Current Status:** PENDING  
**Request:** `{ "status": "PACKED" }`  
**Result:** ✅ Success (PENDING → PACKED is allowed)

**Current Status:** PACKED  
**Request:** `{ "status": "SHIPPED" }`  
**Result:** ✅ Success (PACKED → SHIPPED is allowed)

**Current Status:** SHIPPED  
**Request:** `{ "status": "DELIVERED" }`  
**Result:** ✅ Success (SHIPPED → DELIVERED is allowed, wallet credited)

### Example 2: Vendor Invalid Transition

**Current Status:** PACKED  
**Request:** `{ "status": "DELIVERED" }`  
**Result:** ❌ Error (Cannot skip SHIPPED step)

**Current Status:** PENDING  
**Request:** `{ "status": "SHIPPED" }`  
**Result:** ❌ Error (Must go through PACKED first)

### Example 3: Admin Override

**Current Status:** PENDING  
**Request:** `{ "status": "DELIVERED" }` (by Admin)  
**Result:** ✅ Success (Admin can override, wallet credited)

**Current Status:** SHIPPED  
**Request:** `{ "status": "PACKED" }` (by Admin)  
**Result:** ✅ Success (Admin can set any status)

---

## Workflow Diagram

### Vendor Order Fulfillment Flow

```
1. Order Created (PENDING)
   ↓
2. Payment Verified / COD Confirmed
   ↓
3. Order Status: CONFIRMED
   ↓
4. Commission Calculated
   ↓
5. Vendor Updates: CONFIRMED → PACKED
   ↓
6. Vendor Updates: PACKED → SHIPPED
   ↓
7. Vendor Updates: SHIPPED → DELIVERED
   ↓
8. Wallet Credit Triggered (Automatic)
   ↓
9. Vendor Wallet Credited
```

### Admin Override Flow

```
1. Order Status: PENDING
   ↓
2. Admin Updates: PENDING → DELIVERED (Override)
   ↓
3. Wallet Credit Triggered (Automatic)
   ↓
4. Vendor Wallet Credited
```

---

## Security & Best Practices

### Security

1. **Vendor Ownership:** Vendors can only update their own orders
2. **Role Validation:** Only vendor, admin, super-admin can access
3. **JWT Authentication:** All requests require valid JWT token
4. **Transaction Safety:** Uses MongoDB transactions for atomicity

### Best Practices

1. **Status History:** All changes logged for audit trail
2. **Idempotent Operations:** Setting same status returns success
3. **Double Credit Prevention:** Multiple checks prevent duplicate wallet credits
4. **Error Handling:** Comprehensive error messages
5. **Non-Blocking Wallet Credit:** Wallet credit doesn't block status update

### Performance

1. **Indexes:** Order model has indexes on `orderStatus` and `vendorId`
2. **Transactions:** Uses MongoDB sessions for efficient transaction handling
3. **Efficient Queries:** Optimized queries for order retrieval

---

## Example Use Cases

### 1. Vendor Updates Order to PACKED

```bash
POST /api/vendor/orders/694129c27f75e93fd924715d/status
{
  "status": "PACKED"
}
```

### 2. Vendor Updates Order to SHIPPED

```bash
POST /api/vendor/orders/694129c27f75e93fd924715d/status
{
  "status": "SHIPPED"
}
```

### 3. Vendor Updates Order to DELIVERED

```bash
POST /api/vendor/orders/694129c27f75e93fd924715d/status
{
  "status": "DELIVERED"
}
```

### 4. Admin Overrides Order Status

```bash
POST /api/vendor/orders/694129c27f75e93fd924715d/status
Authorization: Bearer <admin-token>
{
  "status": "DELIVERED"
}
```

---

## Testing Checklist

- [ ] Vendor updates own order status (PACKED)
- [ ] Vendor updates own order status (SHIPPED)
- [ ] Vendor updates own order status (DELIVERED)
- [ ] Vendor cannot update other vendor's order
- [ ] Vendor cannot skip status steps
- [ ] Admin can update any order
- [ ] Admin can override status transitions
- [ ] Super Admin can update any order
- [ ] Status history is logged
- [ ] Wallet credit triggered on DELIVERED
- [ ] Double credit prevention
- [ ] Idempotent status update
- [ ] Invalid status validation
- [ ] Invalid order ID validation

---

## Future Enhancements

1. **Bulk Status Update:** Update multiple orders at once
2. **Status Change Notifications:** Notify customer on status change
3. **Delivery Tracking:** Integration with shipping providers
4. **Status Change Webhooks:** Webhook support for status changes
5. **Status Change Analytics:** Analytics dashboard for order fulfillment
6. **Custom Status Workflows:** Configurable status workflows per vendor
7. **Status Change Approval:** Require approval for certain status changes
8. **Delivery Confirmation:** Customer confirmation before marking as delivered

