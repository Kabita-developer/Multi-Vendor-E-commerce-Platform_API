# Vendor Withdrawal Request API Documentation

## Overview

This document describes the Vendor Withdrawal Request API. This API allows vendors to request withdrawal from their wallet balance. Withdrawal requests remain in PENDING state until admin approval.

**Base URL:** `/api/vendor`

**Authentication:** All withdrawal endpoints require JWT authentication with vendor role.

---

## REQUEST WITHDRAWAL

### Endpoint

`POST /api/vendor/wallet/withdraw`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated vendors can request withdrawal
- Vendor can withdraw only from available wallet balance
- Withdrawal amount must be > 0
- Amount is moved to HOLD balance
- Withdrawal status starts as PENDING
- Actual payout happens only after admin approval

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | Number | Yes | Withdrawal amount (must be > 0) |

### Request Example

```json
{
  "amount": 500.00
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/vendor/wallet/withdraw \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500.00
  }'
```

### Controller Logic (Step by Step)

1. **Authenticate vendor** using JWT token
2. **Extract vendorId** from token
3. **Validate request body:**
   - `amount` must be a positive number
4. **Fetch vendor wallet** by vendorId
5. **If wallet not found** → create new wallet
6. **Check if wallet.balance >= amount**
7. **If insufficient** → return error
8. **Create WithdrawalRequest** with:
   - `vendorId`
   - `amount`
   - `status = "PENDING"`
9. **Update wallet:**
   - `balance -= amount`
   - `holdBalance += amount`
10. **Add transaction record**
11. **Save wallet**
12. **Save withdrawal request**
13. **Return success response**

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "data": {
    "requestId": "694129c27f75e93fd924715d",
    "amount": 500.00,
    "status": "PENDING",
    "availableBalance": 1000.00,
    "holdBalance": 500.00
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `data` | Object | Response data |
| `data.requestId` | String | Withdrawal request ID |
| `data.amount` | Number | Withdrawal amount |
| `data.status` | String | Request status (PENDING) |
| `data.availableBalance` | Number | Remaining available balance |
| `data.holdBalance` | Number | Total amount on hold |

### Error Responses

#### Missing Amount
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Amount is required and must be a number"
}
```

#### Invalid Amount (Zero or Negative)
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Withdrawal amount must be greater than 0"
}
```

#### Insufficient Balance
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Insufficient balance. Available balance: 100.00"
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
  "message": "Access denied. Vendor role required."
}
```

### Notes

1. **Balance Holding:** Amount is moved from `balance` to `holdBalance` immediately
2. **Transaction Record:** Transaction is logged in wallet transactions
3. **PENDING Status:** Request starts as PENDING until admin approval
4. **Transaction Safety:** Uses MongoDB transactions for atomicity
5. **Precision:** Amounts rounded to 2 decimal places

---

## Database Schema

### WithdrawalRequest Model

```javascript
{
  vendorId: ObjectId,        // Reference to Vendor
  amount: Number,            // Withdrawal amount
  status: String,           // PENDING | APPROVED | REJECTED | PAID
  requestedAt: Date,        // Request timestamp
  approvedAt: Date,         // Approval timestamp (optional)
  approvedBy: ObjectId,     // Admin who approved (optional)
  rejectedAt: Date,         // Rejection timestamp (optional)
  rejectedBy: ObjectId,     // Admin who rejected (optional)
  rejectionReason: String,  // Reason for rejection (optional)
  paidAt: Date,             // Payment timestamp (optional)
  paymentReference: String, // Payment reference (optional)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- Index on `vendorId` and `status` for fast queries
- Index on `vendorId` and `createdAt` for vendor history
- Index on `status` and `createdAt` for admin queries

### VendorWallet Model (Updated)

```javascript
{
  vendorId: ObjectId,
  balance: Number,          // Available balance
  holdBalance: Number,      // Amount on hold (pending withdrawals)
  transactions: [
    {
      type: "CREDIT" | "DEBIT",
      amount: Number,
      orderId: ObjectId,
      description: String,
      createdAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

## Business Rules

### Withdrawal Eligibility

1. **Available Balance:** Vendor can withdraw only from available `balance`
2. **Minimum Amount:** Withdrawal amount must be > 0
3. **Balance Check:** System checks `balance >= amount` before processing
4. **Hold Balance:** Amount moved to `holdBalance` immediately

### Withdrawal Status Flow

```
PENDING → APPROVED → PAID
         ↓
      REJECTED
```

1. **PENDING:** Initial status when request is created
2. **APPROVED:** Admin approves the request
3. **PAID:** Payment processed and completed
4. **REJECTED:** Admin rejects the request (holdBalance released back to balance)

### Balance Management

1. **On Request:**
   - `balance -= amount`
   - `holdBalance += amount`

2. **On Approval:**
   - `holdBalance` remains (amount still on hold)

3. **On Payment:**
   - `holdBalance -= amount`
   - Amount paid out

4. **On Rejection:**
   - `holdBalance -= amount`
   - `balance += amount` (refunded)

---

## Example Scenarios

### Scenario 1: Valid Withdrawal Request

**Wallet Balance:** 1000.00  
**Request:** `{ "amount": 500.00 }`  
**Result:**
- ✅ Withdrawal request created (PENDING)
- Balance: 500.00
- Hold Balance: 500.00
- Transaction logged

### Scenario 2: Insufficient Balance

**Wallet Balance:** 100.00  
**Request:** `{ "amount": 500.00 }`  
**Result:**
- ❌ Error: "Insufficient balance. Available balance: 100.00"

### Scenario 3: Invalid Amount

**Request:** `{ "amount": 0 }`  
**Result:**
- ❌ Error: "Withdrawal amount must be greater than 0"

**Request:** `{ "amount": -100 }`  
**Result:**
- ❌ Error: "Withdrawal amount must be greater than 0"

### Scenario 4: Multiple Withdrawal Requests

**Wallet Balance:** 1000.00  
**Request 1:** `{ "amount": 300.00 }`  
- Balance: 700.00, Hold Balance: 300.00

**Request 2:** `{ "amount": 200.00 }`  
- Balance: 500.00, Hold Balance: 500.00

**Request 3:** `{ "amount": 600.00 }`  
- ❌ Error: "Insufficient balance. Available balance: 500.00"

---

## Security & Best Practices

### Security

1. **Vendor Ownership:** Vendors can only access their own wallet
2. **Balance Validation:** Server-side validation (never trust frontend)
3. **Hold Balance:** Prevents double spending
4. **Transaction Safety:** Uses MongoDB transactions for atomicity

### Best Practices

1. **Balance Holding:** Amount held immediately to prevent double withdrawal
2. **Transaction Logging:** All withdrawals logged in transaction history
3. **Precision:** Amounts rounded to 2 decimal places
4. **Error Handling:** Comprehensive error messages
5. **Status Tracking:** Clear status flow for admin approval

### Performance

1. **Indexes:** WithdrawalRequest model has indexes for fast queries
2. **Transactions:** Uses MongoDB sessions for efficient transaction handling
3. **Atomic Operations:** All wallet updates are atomic

---

## Withdrawal Flow Diagram

```
1. Vendor Requests Withdrawal
   ↓
2. Validate Amount > 0
   ↓
3. Check Balance >= Amount
   ↓
4. Create WithdrawalRequest (PENDING)
   ↓
5. Move Amount to Hold Balance
   balance -= amount
   holdBalance += amount
   ↓
6. Log Transaction
   ↓
7. Return Success Response
   ↓
8. Admin Reviews Request
   ↓
9. Admin Approves/Rejects
   ↓
10. If Approved → Process Payment
    If Rejected → Release Hold Balance
```

---

## Integration with Admin Approval

### Admin Approval Flow (Future Implementation)

1. **Admin Reviews:** Admin views pending withdrawal requests
2. **Admin Approves:** Status changed to APPROVED
3. **Payment Processing:** Payment processed (external system)
4. **Mark as Paid:** Status changed to PAID, holdBalance released

### Admin Rejection Flow (Future Implementation)

1. **Admin Rejects:** Status changed to REJECTED
2. **Release Hold:** holdBalance released back to balance
3. **Notify Vendor:** Vendor notified of rejection

---

## Testing Checklist

- [ ] Request withdrawal with valid amount
- [ ] Prevent withdrawal with zero amount
- [ ] Prevent withdrawal with negative amount
- [ ] Prevent withdrawal with insufficient balance
- [ ] Balance and holdBalance updated correctly
- [ ] Transaction logged correctly
- [ ] Withdrawal request created with PENDING status
- [ ] Multiple withdrawal requests handled correctly
- [ ] Authentication required
- [ ] Vendor role validation
- [ ] Amount precision (2 decimal places)

---

## Future Enhancements

1. **Get Withdrawal History:** List all withdrawal requests for vendor
2. **Get Pending Withdrawals:** List pending requests for admin
3. **Admin Approval API:** Approve/reject withdrawal requests
4. **Payment Processing:** Integrate with payment gateway
5. **Withdrawal Limits:** Set minimum/maximum withdrawal limits
6. **Withdrawal Schedule:** Scheduled withdrawals (e.g., weekly)
7. **Bank Account Management:** Manage vendor bank accounts
8. **Withdrawal Fees:** Apply withdrawal fees
9. **Email Notifications:** Notify vendor on status changes
10. **Withdrawal Analytics:** Analytics dashboard for withdrawals

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
- `400` - Bad Request (validation errors, insufficient balance)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (role/permission denied)
- `500` - Internal Server Error (server errors)

---

## Example Responses

### Successful Withdrawal Request

```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "data": {
    "requestId": "694129c27f75e93fd924715d",
    "amount": 500.00,
    "status": "PENDING",
    "availableBalance": 500.00,
    "holdBalance": 500.00
  }
}
```

### Insufficient Balance Error

```json
{
  "success": false,
  "message": "Insufficient balance. Available balance: 100.00"
}
```

### Invalid Amount Error

```json
{
  "success": false,
  "message": "Withdrawal amount must be greater than 0"
}
```

