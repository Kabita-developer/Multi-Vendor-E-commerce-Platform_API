# Vendor Wallet Credit API Documentation

## Overview

This document describes the Vendor Wallet Credit system for the Multi-Vendor E-commerce Platform. The system credits vendor wallets ONLY when orders are marked as DELIVERED, using the commission snapshot stored in the order.

**Base URL:** `/api/wallet-credit`

**Authentication:** All endpoints require JWT authentication with vendor role.

---

## Business Rules

### Wallet Credit Rules

1. **Credit Trigger:** Wallet is credited ONLY when `orderStatus = "DELIVERED"`
2. **Commission Source:** Uses commission snapshot from `order.commission.vendorAmount`
3. **One-Time Credit:** Wallet credit happens ONLY ONCE per order
4. **Double Credit Prevention:** Multiple safety checks prevent double credit
5. **Transaction History:** All wallet credits are recorded in transaction history

### Commission Snapshot

- Commission is calculated and stored in order when order is CONFIRMED
- Commission snapshot includes:
  - `rate`: Commission rate used
  - `platformAmount`: Platform commission
  - `vendorAmount`: Vendor earning amount
- Commission snapshot is NEVER recalculated for wallet credit
- Uses exact `vendorAmount` from commission snapshot

---

## CREDIT WALLET

### Endpoint

`POST /api/wallet-credit/credit`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated vendors can credit wallet
- Vendor can only credit wallet for their own orders
- Order must be in DELIVERED status
- Commission must be calculated before credit

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | String | Yes | Order ID to credit wallet for |

### Request Example

```json
{
  "orderId": "694129c27f75e93fd924715d"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/wallet-credit/credit \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "694129c27f75e93fd924715d"
  }'
```

### Wallet Credit Logic (Step by Step)

1. Fetch order by orderId
2. Ensure order exists
3. Ensure `orderStatus === "DELIVERED"`
4. Check if `walletCredited === true`
   - If yes, stop execution (prevent double credit)
5. Read `vendorAmount` from `order.commission.vendorAmount`
6. Fetch vendor wallet by vendorId
7. If wallet does not exist, create it
8. Add vendorAmount to wallet.balance
9. Push transaction entry:
   ```json
   {
     "type": "CREDIT",
     "amount": vendorAmount,
     "orderId": orderId,
     "description": "Order delivered - vendor earning credited"
   }
   ```
10. Set `order.commission.walletCredited = true`
11. Save wallet and order
12. Return success response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Vendor wallet credited successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1704067200000-1234",
    "vendorAmount": 899.99,
    "walletBalance": 4500.50,
    "alreadyCredited": false
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `data` | Object | Response data |
| `data.orderId` | String | Order ID |
| `data.orderNumber` | String | Order number |
| `data.vendorAmount` | Number | Amount credited to wallet |
| `data.walletBalance` | Number | Updated wallet balance |
| `data.alreadyCredited` | Boolean | Whether wallet was already credited |

### Already Credited Response

If wallet was already credited:

```json
{
  "success": true,
  "message": "Vendor wallet already credited for this order",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1704067200000-1234",
    "alreadyCredited": true
  }
}
```

### Error Responses

#### Missing Order ID
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Order ID is required"
}
```

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
  "message": "You are not authorized to credit wallet for this order"
}
```

#### Order Not Delivered
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Order is not delivered. Current status: CONFIRMED. Only DELIVERED orders can be credited."
}
```

#### Commission Not Calculated
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Commission not calculated for this order. Commission must be calculated before wallet credit."
}
```

---

## MARK ORDER DELIVERED AND CREDIT WALLET

### Endpoint

`POST /api/wallet-credit/deliver`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated vendors can mark orders as delivered
- Vendor can only mark their own orders as delivered
- Order must be in CONFIRMED, PROCESSING, or SHIPPED status
- Commission must be calculated before delivery

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | String | Yes | Order ID to mark as delivered |

### Request Example

```json
{
  "orderId": "694129c27f75e93fd924715d"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/wallet-credit/deliver \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "694129c27f75e93fd924715d"
  }'
```

### Controller Logic

1. Validate orderId
2. Fetch order and verify ownership
3. Check if already delivered:
   - If yes, try to credit wallet if not already credited
4. Validate order can be marked as delivered (status must be CONFIRMED, PROCESSING, or SHIPPED)
5. Check if commission is calculated
6. Update order status to DELIVERED
7. Credit vendor wallet
8. Return success response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Order marked as delivered and vendor wallet credited successfully",
  "data": {
    "orderId": "694129c27f75e93fd924715d",
    "orderNumber": "ORD-1704067200000-1234",
    "orderStatus": "DELIVERED",
    "vendorAmount": 899.99,
    "walletBalance": 4500.50,
    "walletCredited": true
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `data` | Object | Response data |
| `data.orderId` | String | Order ID |
| `data.orderNumber` | String | Order number |
| `data.orderStatus` | String | Order status (DELIVERED) |
| `data.vendorAmount` | Number | Amount credited to wallet |
| `data.walletBalance` | Number | Updated wallet balance |
| `data.walletCredited` | Boolean | Whether wallet was credited |

### Error Responses

#### Invalid Order Status
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Cannot mark order as DELIVERED. Current status: PENDING"
}
```

#### Commission Not Calculated
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Commission not calculated for this order. Commission must be calculated before delivery."
}
```

---

## Validations & Safety

### Double Credit Prevention

1. **Flag Check:** Checks `order.commission.walletCredited` flag
2. **Transaction Check:** Checks for existing transaction with same orderId
3. **Idempotent:** Can be called multiple times safely (returns success if already credited)

### Rounding

- All amounts rounded to 2 decimal places
- Uses `Math.round(value * 100) / 100`
- Prevents floating-point precision issues

### Commission Snapshot

- **Never Recalculated:** Uses exact `vendorAmount` from commission snapshot
- **Immutable:** Commission snapshot never changes after calculation
- **Audit Trail:** Commission details preserved in order document

### Race Condition Prevention

- Uses MongoDB transactions for atomic operations
- Checks both `walletCredited` flag and existing transaction
- Prevents concurrent credit attempts

---

## Database Schema

### Order Model (Commission Fields)

```javascript
{
  // ... other order fields
  orderStatus: String,  // Must be "DELIVERED" for wallet credit
  commission: {
    rate: Number,         // Commission rate used
    platformAmount: Number,  // Platform commission
    vendorAmount: Number,    // Vendor earning (used for wallet credit)
    calculatedAt: Date,     // When commission was calculated
    walletCredited: Boolean  // Whether wallet was credited (default: false)
  }
}
```

### VendorWallet Model

```javascript
{
  vendorId: ObjectId,     // Reference to Vendor (unique)
  balance: Number,        // Current wallet balance
  transactions: [
    {
      type: String,      // "CREDIT" or "DEBIT"
      amount: Number,     // Transaction amount
      orderId: ObjectId, // Reference to Order
      description: String, // Transaction description
      createdAt: Date
    }
  ]
}
```

---

## Workflow

### Complete Order Lifecycle

```
1. Order Created (PENDING)
   ↓
2. Payment Verified / COD Confirmed
   ↓
3. Order Status: CONFIRMED
   ↓
4. Commission Calculated (stored in order.commission)
   ↓
5. Order Status: PROCESSING → SHIPPED
   ↓
6. Order Status: DELIVERED
   ↓
7. Wallet Credit Triggered
   ↓
8. Vendor Wallet Credited
   ↓
9. Transaction Recorded
```

### Commission vs Wallet Credit

- **Commission Calculation:** Happens when order is CONFIRMED
  - Calculates commission based on subTotal
  - Stores commission snapshot in order
  - Does NOT credit wallet yet

- **Wallet Credit:** Happens when order is DELIVERED
  - Uses commission snapshot (vendorAmount)
  - Credits vendor wallet
  - Records transaction
  - Marks walletCredited = true

---

## Example Scenarios

### Scenario 1: Normal Flow

**Order Details:**
- Order Status: SHIPPED
- Commission: { vendorAmount: 900 }

**Action:** Mark order as DELIVERED

**Result:**
- Order status updated to DELIVERED
- Wallet credited with ₹900
- Transaction created
- walletCredited = true

### Scenario 2: Already Delivered

**Order Details:**
- Order Status: DELIVERED
- walletCredited: true

**Action:** Try to credit wallet again

**Result:**
- Returns success message
- No duplicate credit
- No error thrown

### Scenario 3: Commission Not Calculated

**Order Details:**
- Order Status: SHIPPED
- Commission: null

**Action:** Mark order as DELIVERED

**Result:**
- Error: "Commission not calculated for this order"
- Order status not updated
- Wallet not credited

---

## Security & Best Practices

### Security

1. **Vendor Isolation:** Vendors can only credit wallet for their own orders
2. **Transaction Safety:** All operations use MongoDB transactions
3. **Double Credit Prevention:** Multiple checks prevent duplicate credits

### Best Practices

1. **Idempotent Operations:** Can be called multiple times safely
2. **Commission Snapshot:** Never recalculates commission
3. **Transaction History:** All credits recorded for audit
4. **Rounding:** All amounts rounded to 2 decimal places
5. **Error Handling:** Comprehensive error messages

### Performance

1. **Indexes:** Order model has indexes on `orderStatus` and `vendorId`
2. **Transactions:** Uses MongoDB sessions for atomic operations
3. **Efficient Queries:** Optimized queries for order and wallet retrieval

---

## Testing Checklist

- [ ] Credit wallet for delivered order
- [ ] Prevent credit for non-delivered order
- [ ] Prevent double credit (flag check)
- [ ] Prevent double credit (transaction check)
- [ ] Handle missing commission
- [ ] Handle invalid order ID
- [ ] Handle unauthorized access
- [ ] Mark order as delivered and credit wallet
- [ ] Handle already delivered order
- [ ] Rounding to 2 decimal places
- [ ] Transaction recording
- [ ] Wallet creation if doesn't exist

---

## Future Enhancements

1. **Bulk Delivery:** Mark multiple orders as delivered at once
2. **Delivery Confirmation:** Customer confirmation before wallet credit
3. **Partial Delivery:** Handle partial order delivery
4. **Delivery Time Tracking:** Track delivery time for analytics
5. **Auto Credit:** Automatic wallet credit on delivery (webhook/event)
6. **Credit Reversal:** Reverse wallet credit on order cancellation
7. **Delivery Notifications:** Notify vendor on successful wallet credit

