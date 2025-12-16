# Order Tracking API Documentation

## Overview

This document describes the Order Tracking API for customers. This API allows customers to track their orders in real-time and view the delivery timeline.

**Base URL:** `/api/orders`

**Authentication:** All tracking endpoints require JWT authentication with customer role.

---

## TRACK ORDER

### Endpoint

`GET /api/orders/:id/track`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can track orders
- Customers can ONLY track their own orders
- Strict ownership validation enforced
- Vendor/admin internal data is hidden

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### Request Example

```bash
curl -X GET http://localhost:3000/api/orders/694129c27f75e93fd924715d/track \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Controller Logic (Step by Step)

1. **Authenticate user** using JWT token
2. **Ensure user role** is "customer"
3. **Fetch order** by orderId
4. **If order not found** → return 404
5. **Check order.userId === logged-in userId**
   - If not, return unauthorized error
6. **Prepare tracking response:**
   - `currentStatus = order.orderStatus`
   - `timeline` from statusHistory
7. **Map statusHistory** to user-friendly messages
8. **Return tracking response**

### Status Message Mapping

| Status | User-Friendly Message |
|--------|----------------------|
| PENDING | "Order placed successfully" |
| CONFIRMED | "Order confirmed" |
| PACKED | "Seller packed your order" |
| PROCESSING | "Order is being processed" |
| SHIPPED | "Order shipped" |
| DELIVERED | "Order delivered" |
| CANCELLED | "Order cancelled" |

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "orderId": "694129c27f75e93fd924715d",
  "orderNumber": "ORD-1704067200000-1234",
  "currentStatus": "SHIPPED",
  "currentStatusMessage": "Order shipped",
  "timeline": [
    {
      "status": "PENDING",
      "message": "Order placed successfully",
      "date": "2024-01-10T10:00:00.000Z",
      "updatedBy": "system"
    },
    {
      "status": "CONFIRMED",
      "message": "Order confirmed",
      "date": "2024-01-10T10:05:00.000Z",
      "updatedBy": "system"
    },
    {
      "status": "PACKED",
      "message": "Seller packed your order",
      "date": "2024-01-11T14:30:00.000Z",
      "updatedBy": "vendor"
    },
    {
      "status": "SHIPPED",
      "message": "Order shipped",
      "date": "2024-01-12T09:15:00.000Z",
      "updatedBy": "vendor"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `orderId` | String | Order ID |
| `orderNumber` | String | Order number (e.g., ORD-1704067200000-1234) |
| `currentStatus` | String | Current order status |
| `currentStatusMessage` | String | User-friendly message for current status |
| `timeline` | Array | Array of status change events (chronological order) |

#### Timeline Entry Object

| Field | Type | Description |
|-------|------|-------------|
| `status` | String | Order status at this point |
| `message` | String | User-friendly message |
| `date` | String | Timestamp of status change (ISO 8601) |
| `updatedBy` | String | Who updated the status ("vendor", "admin", "super-admin", or "system") |

### Error Responses

#### Invalid Order ID Format
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

#### Unauthorized Access
**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "You are not authorized to track this order"
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

1. **Ownership Validation:** Customers can only track their own orders
2. **Data Privacy:** Vendor/admin internal data (commission, wallet info) is not exposed
3. **Timeline Order:** Timeline is sorted chronologically (oldest first)
4. **Status History:** Includes initial PENDING status from order creation
5. **User-Friendly Messages:** All statuses mapped to customer-friendly messages

---

## Timeline Building Logic

### Timeline Construction

1. **Initial Status:** Always includes PENDING status from order creation
2. **Status History:** Adds all status changes from `statusHistory` array
3. **Deduplication:** Skips duplicate consecutive statuses
4. **Chronological Order:** Timeline sorted by date (oldest first)
5. **Message Mapping:** Each status mapped to user-friendly message

### Example Timeline Scenarios

#### Scenario 1: New Order (No Status History)

```json
{
  "timeline": [
    {
      "status": "PENDING",
      "message": "Order placed successfully",
      "date": "2024-01-10T10:00:00.000Z",
      "updatedBy": "system"
    }
  ]
}
```

#### Scenario 2: Order with Status History

```json
{
  "timeline": [
    {
      "status": "PENDING",
      "message": "Order placed successfully",
      "date": "2024-01-10T10:00:00.000Z",
      "updatedBy": "system"
    },
    {
      "status": "PACKED",
      "message": "Seller packed your order",
      "date": "2024-01-11T14:30:00.000Z",
      "updatedBy": "vendor"
    },
    {
      "status": "SHIPPED",
      "message": "Order shipped",
      "date": "2024-01-12T09:15:00.000Z",
      "updatedBy": "vendor"
    },
    {
      "status": "DELIVERED",
      "message": "Order delivered",
      "date": "2024-01-13T16:45:00.000Z",
      "updatedBy": "vendor"
    }
  ]
}
```

---

## Security & Best Practices

### Security

1. **Strict Ownership Validation:** Customers can only track their own orders
2. **JWT Authentication:** All requests require valid JWT token
3. **Role Validation:** Only customers can access tracking API
4. **Data Privacy:** Internal data (commission, vendor info) not exposed

### Best Practices

1. **Clean Response:** Only returns relevant tracking information
2. **User-Friendly Messages:** Statuses mapped to readable messages
3. **Chronological Timeline:** Timeline sorted by date for easy reading
4. **Immutable History:** Status history never modified
5. **Error Handling:** Comprehensive error messages

### Performance

1. **Selective Fields:** Only fetches required fields from database
2. **Lean Queries:** Uses `.lean()` for read-only queries
3. **Indexes:** Order model has indexes on `userId` for fast lookups

---

## Example Use Cases

### 1. Track New Order

**Order Status:** PENDING  
**Timeline:** Shows only "Order placed successfully"

### 2. Track Packed Order

**Order Status:** PACKED  
**Timeline:** Shows PENDING → PACKED with timestamps

### 3. Track Shipped Order

**Order Status:** SHIPPED  
**Timeline:** Shows PENDING → PACKED → SHIPPED with full timeline

### 4. Track Delivered Order

**Order Status:** DELIVERED  
**Timeline:** Shows complete journey from PENDING to DELIVERED

---

## Data Privacy

### Exposed Data

- Order ID and order number
- Current order status
- Status timeline (with user-friendly messages)
- Timestamps

### Hidden Data

- Commission details
- Vendor wallet information
- Vendor internal notes
- Admin notes
- Payment gateway details
- Internal status codes

---

## Testing Checklist

- [ ] Track own order successfully
- [ ] Cannot track other customer's order
- [ ] Invalid order ID validation
- [ ] Order not found handling
- [ ] Timeline for new order (PENDING only)
- [ ] Timeline for order with status history
- [ ] Status message mapping
- [ ] Chronological timeline order
- [ ] Authentication required
- [ ] Customer role validation

---

## Future Enhancements

1. **Delivery Estimates:** Estimated delivery date/time
2. **Tracking Number:** Shipping tracking number integration
3. **Location Tracking:** Real-time location updates (if available)
4. **Delivery Proof:** Delivery confirmation with photos
5. **SMS/Email Notifications:** Notify customer on status changes
6. **Delivery Agent Info:** Delivery agent contact information
7. **Reschedule Delivery:** Allow customer to reschedule delivery
8. **Delivery Rating:** Rate delivery experience

---

## Integration with Order Fulfillment

The tracking API automatically reflects status changes made through the Order Fulfillment API:

- When vendor updates order status → Timeline updated
- When admin updates order status → Timeline updated
- Status history is immutable → Provides audit trail

---

## Example Responses

### Response for PENDING Order

```json
{
  "success": true,
  "orderId": "694129c27f75e93fd924715d",
  "orderNumber": "ORD-1704067200000-1234",
  "currentStatus": "PENDING",
  "currentStatusMessage": "Order placed successfully",
  "timeline": [
    {
      "status": "PENDING",
      "message": "Order placed successfully",
      "date": "2024-01-10T10:00:00.000Z",
      "updatedBy": "system"
    }
  ]
}
```

### Response for DELIVERED Order

```json
{
  "success": true,
  "orderId": "694129c27f75e93fd924715d",
  "orderNumber": "ORD-1704067200000-1234",
  "currentStatus": "DELIVERED",
  "currentStatusMessage": "Order delivered",
  "timeline": [
    {
      "status": "PENDING",
      "message": "Order placed successfully",
      "date": "2024-01-10T10:00:00.000Z",
      "updatedBy": "system"
    },
    {
      "status": "CONFIRMED",
      "message": "Order confirmed",
      "date": "2024-01-10T10:05:00.000Z",
      "updatedBy": "system"
    },
    {
      "status": "PACKED",
      "message": "Seller packed your order",
      "date": "2024-01-11T14:30:00.000Z",
      "updatedBy": "vendor"
    },
    {
      "status": "SHIPPED",
      "message": "Order shipped",
      "date": "2024-01-12T09:15:00.000Z",
      "updatedBy": "vendor"
    },
    {
      "status": "DELIVERED",
      "message": "Order delivered",
      "date": "2024-01-13T16:45:00.000Z",
      "updatedBy": "vendor"
    }
  ]
}
```

