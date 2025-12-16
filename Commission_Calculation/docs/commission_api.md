# Commission Calculation & Vendor Wallet API Documentation

## Overview

This document describes the Commission Calculation and Vendor Wallet system for the Multi-Vendor E-commerce Platform. The system automatically calculates platform commission and credits vendor earnings to their wallet when orders are confirmed.

**Base URL:** `/api/commission`

**Authentication:** Wallet endpoints require JWT authentication with vendor role.

---

## Business Rules

### Commission Calculation

1. **Commission Types:**
   - **Global Commission:** Default commission rate set by admin (applies to all vendors)
   - **Vendor-Specific Commission:** Custom commission rate for specific vendors (overrides global)

2. **Priority:** Vendor-specific commission rate has higher priority than global rate

3. **Calculation Trigger:**
   - When ONLINE payment is verified (`paymentStatus = PAID`, `orderStatus = CONFIRMED`)
   - When COD order is confirmed (`orderStatus = CONFIRMED`)

4. **Commission Formula:**
   ```
   platformAmount = subTotal * (commissionRate / 100)
   vendorAmount = subTotal - platformAmount
   ```

5. **Commission Snapshot:** Commission details are saved in Order document and never change

### Vendor Wallet

1. **Wallet Credit:** Vendor earnings are credited to wallet when order is confirmed
2. **One Wallet Per Vendor:** Each vendor has exactly one wallet
3. **Transaction History:** All wallet transactions are recorded
4. **Prevent Double Credit:** System prevents crediting same order multiple times

---

## Database Schema

### CommissionConfig Model

```javascript
{
  globalRate: Number,        // Global commission rate (e.g., 10 for 10%)
  updatedBy: ObjectId,        // Admin/SuperAdmin who updated
  updatedByRole: String,      // "SuperAdmin" or "Admin"
  createdAt: Date,
  updatedAt: Date
}
```

### VendorWallet Model

```javascript
{
  vendorId: ObjectId,         // Reference to Vendor (unique)
  balance: Number,            // Current wallet balance
  transactions: [
    {
      type: String,           // "CREDIT" or "DEBIT"
      amount: Number,         // Transaction amount
      orderId: ObjectId,      // Reference to Order
      description: String,    // Transaction description
      createdAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Order Model (Commission Fields)

```javascript
{
  // ... other order fields
  commission: {
    rate: Number,             // Commission rate used
    platformAmount: Number,   // Platform commission amount
    vendorAmount: Number,    // Vendor earning amount
    calculatedAt: Date,       // When commission was calculated
    walletCredited: Boolean   // Whether wallet was credited
  }
}
```

### Vendor Model (Commission Field)

```javascript
{
  // ... other vendor fields
  commissionRate: Number      // Optional vendor-specific commission rate
}
```

---

## GET VENDOR WALLET

### Endpoint

`GET /api/commission/wallet`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated vendors can view their own wallet
- Wallet is automatically created if doesn't exist

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### Request Example

```bash
curl -X GET http://localhost:3000/api/commission/wallet \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "wallet": {
    "vendorId": "693fbef1493989b8b80a31a6",
    "balance": 4500.50,
    "totalTransactions": 25
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `wallet` | Object | Wallet information |
| `wallet.vendorId` | String | Vendor ID |
| `wallet.balance` | Number | Current wallet balance |
| `wallet.totalTransactions` | Number | Total number of transactions |

---

## GET VENDOR WALLET TRANSACTIONS

### Endpoint

`GET /api/commission/wallet/transactions`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `page` | Number | No | Page number | 1 |
| `limit` | Number | No | Items per page (max 100) | 50 |

### Request Example

```bash
curl -X GET "http://localhost:3000/api/commission/wallet/transactions?page=1&limit=20" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "wallet": {
    "balance": 4500.50,
    "transactions": [
      {
        "_id": "694129c27f75e93fd924715d",
        "type": "CREDIT",
        "amount": 899.99,
        "orderId": "694129c27f75e93fd924715e",
        "description": "Order earning credit - Order #ORD-1704067200000-1234",
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "_id": "694129c27f75e93fd924715f",
        "type": "CREDIT",
        "amount": 450.00,
        "orderId": "694129c27f75e93fd924715g",
        "description": "Order earning credit - Order #ORD-1704067200001-5678",
        "createdAt": "2024-01-14T15:20:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "pages": 2
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `wallet` | Object | Wallet information |
| `wallet.balance` | Number | Current wallet balance |
| `wallet.transactions` | Array | Array of transactions (newest first) |
| `wallet.pagination` | Object | Pagination information |

#### Transaction Object

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Transaction ID |
| `type` | String | Transaction type (CREDIT or DEBIT) |
| `amount` | Number | Transaction amount |
| `orderId` | String | Associated order ID |
| `description` | String | Transaction description |
| `createdAt` | String | Transaction timestamp |

---

## Commission Calculation Flow

### Automatic Calculation

Commission is automatically calculated and wallet is credited when:

1. **ONLINE Payment Verified:**
   - Payment verification succeeds
   - Order status updated to `CONFIRMED`
   - Payment status updated to `PAID`
   - Commission calculated and wallet credited

2. **COD Order Confirmed:**
   - COD confirmation succeeds
   - Order status updated to `CONFIRMED`
   - Commission calculated and wallet credited

### Calculation Steps

1. **Fetch Commission Rate:**
   - Get global commission rate from `CommissionConfig`
   - Get vendor-specific commission rate (if exists)
   - Use vendor-specific rate if available, otherwise use global rate

2. **Calculate Commission:**
   ```
   platformAmount = round(subTotal * (rate / 100), 2)
   vendorAmount = round(subTotal - platformAmount, 2)
   ```

3. **Save Commission Snapshot:**
   - Save commission details in Order document
   - Mark as not yet credited to wallet

4. **Credit Vendor Wallet:**
   - Get or create vendor wallet
   - Check if order already credited (prevent double credit)
   - Add vendor amount to wallet balance
   - Create transaction record
   - Mark commission as credited in order

### Idempotency

The commission calculation is **idempotent**:
- Can be called multiple times safely
- Prevents double credit using `walletCredited` flag
- Checks for existing transaction before crediting

---

## Error Handling

### Edge Cases

1. **Double Credit Prevention:**
   - System checks `commission.walletCredited` flag
   - Checks for existing transaction with same orderId
   - Prevents crediting same order multiple times

2. **Rounding:**
   - All amounts rounded to 2 decimal places
   - Uses `Math.round(value * 100) / 100`

3. **Commission Snapshot:**
   - Commission details saved in Order document
   - Never changes after calculation
   - Provides audit trail

4. **Wallet Creation:**
   - Wallet automatically created if doesn't exist
   - Initial balance is 0

### Error Responses

#### Order Not Eligible
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Order is not eligible for commission. Payment Status: PENDING, Order Status: PENDING"
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

---

## Example Scenarios

### Scenario 1: Global Commission (10%)

**Order Details:**
- SubTotal: ₹1000
- Global Commission Rate: 10%
- Vendor-Specific Rate: Not set

**Calculation:**
- Platform Amount: ₹1000 × 10% = ₹100
- Vendor Amount: ₹1000 - ₹100 = ₹900

**Result:**
- Vendor wallet credited with ₹900
- Transaction created: "Order earning credit - Order #ORD-xxx"

### Scenario 2: Vendor-Specific Commission (5%)

**Order Details:**
- SubTotal: ₹1000
- Global Commission Rate: 10%
- Vendor-Specific Rate: 5%

**Calculation:**
- Uses vendor-specific rate (5%)
- Platform Amount: ₹1000 × 5% = ₹50
- Vendor Amount: ₹1000 - ₹50 = ₹950

**Result:**
- Vendor wallet credited with ₹950
- Transaction created: "Order earning credit - Order #ORD-xxx"

### Scenario 3: Multiple Orders

**Orders:**
- Order 1: SubTotal ₹1000, Commission 10% → Vendor gets ₹900
- Order 2: SubTotal ₹500, Commission 10% → Vendor gets ₹450

**Result:**
- Both orders processed automatically
- Wallet balance: ₹1350
- Two transactions created

---

## Integration Points

### Payment Verification Integration

When payment is verified successfully:

```javascript
// In Payment_Processing/controllers/paymentController.js
// After payment verification succeeds:
await commissionService.processCommissionForOrders(orderIds);
```

### COD Confirmation Integration

When COD order is confirmed:

```javascript
// In Payment_Processing/controllers/paymentController.js
// After COD confirmation succeeds:
await commissionService.processCommissionForOrders(orderIds);
```

---

## Security & Best Practices

### Security

1. **Vendor Isolation:** Vendors can only view their own wallet
2. **Transaction Safety:** Commission calculation uses proper error handling
3. **Idempotency:** Prevents double credit through multiple checks

### Best Practices

1. **Automatic Processing:** Commission calculated automatically on order confirmation
2. **Snapshot Preservation:** Commission details never change after calculation
3. **Transaction History:** All wallet transactions are recorded
4. **Rounding:** All amounts rounded to 2 decimal places
5. **Error Handling:** Comprehensive error handling with clear messages

### Performance

1. **Indexes:** Wallet model has indexes on `vendorId` and `transactions.orderId`
2. **Lazy Wallet Creation:** Wallet created only when needed
3. **Efficient Queries:** Optimized queries for wallet and transaction retrieval

---

## Future Enhancements

1. **Debit Transactions:** Support for wallet withdrawals/payouts
2. **Commission Refund:** Reverse commission on order cancellation/refund
3. **Commission Reports:** Detailed commission reports for vendors and platform
4. **Payout Management:** APIs for vendor payout requests
5. **Commission History:** Detailed commission history per order
6. **Multi-Currency:** Support for multiple currencies
7. **Tiered Commission:** Different commission rates based on sales volume
8. **Commission Analytics:** Analytics dashboard for commission trends

---

## Testing Checklist

- [ ] Global commission calculation
- [ ] Vendor-specific commission calculation
- [ ] Commission calculation on payment verification
- [ ] Commission calculation on COD confirmation
- [ ] Wallet credit on order confirmation
- [ ] Double credit prevention
- [ ] Wallet creation if doesn't exist
- [ ] Transaction history recording
- [ ] Rounding to 2 decimal places
- [ ] Commission snapshot preservation
- [ ] Multiple orders processing
- [ ] Error handling for invalid orders

---

## API Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/commission/wallet` | GET | Vendor | Get vendor wallet balance |
| `/api/commission/wallet/transactions` | GET | Vendor | Get wallet transactions |

**Note:** Commission calculation is automatic and doesn't require API calls. It's triggered automatically when orders are confirmed.

