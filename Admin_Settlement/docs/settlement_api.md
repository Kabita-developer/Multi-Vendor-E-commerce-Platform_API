# Admin Settlement (Vendor Payout) API Documentation

## Overview

This document describes the Admin Settlement API for processing vendor payouts. This API allows admins and super-admins to approve vendor withdrawal requests, record bank transfers, and finalize wallet settlements.

**Base URL:** `/api/admin`

**Authentication:** All settlement endpoints require JWT authentication with admin or super-admin role.

---

## PROCESS SETTLEMENT (VENDOR PAYOUT)

### Endpoint

`POST /api/admin/settlements/:vendorId/pay`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only admins and super-admins can process settlements
- Only PENDING withdrawal requests can be paid
- Vendor cannot access this API
- Bank transfer is assumed successful (manual or external system)
- Wallet balance must not be double-deducted
- Hold balance must be cleared after settlement

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `withdrawalRequestId` | String | Yes | Withdrawal request ID to process |
| `paymentReference` | String | Yes | Bank UTR or payment reference number |

### Request Example

```json
{
  "withdrawalRequestId": "694129c27f75e93fd924715d",
  "paymentReference": "UTR12345678901234567890"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/admin/settlements/694129c27f75e93fd924715e/pay \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "withdrawalRequestId": "694129c27f75e93fd924715d",
    "paymentReference": "UTR12345678901234567890"
  }'
```

### Controller Logic (Step by Step)

1. **Authenticate user** using JWT token
2. **Ensure role** is admin or super-admin
3. **Fetch WithdrawalRequest** by withdrawalRequestId
4. **If not found** → return error
5. **Ensure withdrawal.status === "PENDING"**
6. **Ensure withdrawal.vendorId** matches :vendorId
7. **Fetch VendorWallet** by vendorId
8. **Simulate bank transfer success** (manual or external system)
9. **Update wallet:**
   - `holdBalance -= withdrawal.amount`
10. **Push wallet transaction:**
    ```json
    {
      "type": "DEBIT",
      "amount": withdrawal.amount,
      "referenceId": withdrawal._id,
      "description": "Vendor payout completed - Payment Reference: UTR..."
    }
    ```
11. **Update withdrawal:**
    - `status = "PAID"`
    - `paidAt = current date`
    - `paymentReference = provided reference`
    - `approvedBy = admin ID`
    - `approvedAt = current date`
12. **Save wallet and withdrawal**
13. **Return success response**

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Settlement completed successfully",
  "data": {
    "vendorId": "694129c27f75e93fd924715e",
    "withdrawalRequestId": "694129c27f75e93fd924715d",
    "amountPaid": 500.00,
    "paymentReference": "UTR12345678901234567890",
    "paidAt": "2024-01-15T10:30:00.000Z",
    "walletBalance": 1000.00,
    "remainingHoldBalance": 0.00
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `data` | Object | Response data |
| `data.vendorId` | String | Vendor ID |
| `data.withdrawalRequestId` | String | Withdrawal request ID |
| `data.amountPaid` | Number | Amount paid to vendor |
| `data.paymentReference` | String | Bank UTR or payment reference |
| `data.paidAt` | String | Payment timestamp (ISO 8601) |
| `data.walletBalance` | Number | Vendor's remaining wallet balance |
| `data.remainingHoldBalance` | Number | Remaining hold balance after settlement |

### Error Responses

#### Missing Withdrawal Request ID
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Valid withdrawal request ID is required"
}
```

#### Missing Payment Reference
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Payment reference is required"
}
```

#### Invalid Vendor ID
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid vendor ID format"
}
```

#### Withdrawal Request Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Withdrawal request not found"
}
```

#### Withdrawal Not PENDING
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Withdrawal request is already PAID. Only PENDING requests can be paid."
}
```

#### Vendor Mismatch
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Withdrawal request does not belong to this vendor"
}
```

#### Wallet Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Vendor wallet not found"
}
```

#### Insufficient Hold Balance
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Insufficient hold balance. Hold balance: 100.00, Requested: 500.00"
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
  "message": "Access denied. Admin or Super Admin role required."
}
```

### Notes

1. **PENDING Only:** Only PENDING withdrawal requests can be paid
2. **Hold Balance Clear:** Amount deducted from holdBalance after settlement
3. **Transaction Logging:** All settlements logged in wallet transactions
4. **Payment Reference:** Bank UTR or reference stored for audit
5. **Transaction Safety:** Uses MongoDB transactions for atomicity
6. **Idempotency:** Prevents duplicate settlement (status check)

---

## Database Schema

### WithdrawalRequest Model (Updated)

```javascript
{
  vendorId: ObjectId,
  amount: Number,
  status: String,              // PENDING | APPROVED | REJECTED | PAID
  requestedAt: Date,
  approvedAt: Date,            // Set when paid
  approvedBy: ObjectId,         // Admin who processed payment
  rejectedAt: Date,
  rejectedBy: ObjectId,
  rejectionReason: String,
  paidAt: Date,                // Set when paid
  paymentReference: String,    // Bank UTR or reference
  createdAt: Date,
  updatedAt: Date
}
```

### VendorWallet Model (Updated)

```javascript
{
  vendorId: ObjectId,
  balance: Number,             // Available balance
  holdBalance: Number,          // Amount on hold (decremented on payment)
  transactions: [
    {
      type: "CREDIT" | "DEBIT",
      amount: Number,
      orderId: ObjectId,
      referenceId: ObjectId,    // Can reference WithdrawalRequest
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

### Settlement Eligibility

1. **PENDING Status:** Only PENDING withdrawal requests can be paid
2. **Vendor Match:** Withdrawal request must belong to the specified vendor
3. **Hold Balance:** Sufficient holdBalance must exist
4. **Admin Access:** Only admins and super-admins can process settlements

### Settlement Process

1. **Validation:** Verify withdrawal request is PENDING and belongs to vendor
2. **Hold Balance Check:** Ensure sufficient holdBalance exists
3. **Bank Transfer:** Simulate or process bank transfer (manual/external)
4. **Wallet Update:** Decrement holdBalance
5. **Transaction Log:** Record DEBIT transaction
6. **Status Update:** Mark withdrawal as PAID
7. **Audit Trail:** Store payment reference and admin info

### Balance Management

**On Settlement:**
- `holdBalance -= amount` (amount released from hold)
- Transaction logged with reference to withdrawal request
- Withdrawal status changed to PAID

**Balance Flow:**
```
Initial: balance = 1000, holdBalance = 500
After Settlement: balance = 1000, holdBalance = 0
```

---

## Example Scenarios

### Scenario 1: Valid Settlement

**Withdrawal Request:** PENDING, amount 500.00  
**Wallet:** balance = 1000.00, holdBalance = 500.00  
**Request:** `{ "withdrawalRequestId": "...", "paymentReference": "UTR123..." }`  
**Result:**
- ✅ Settlement completed
- holdBalance: 0.00
- Withdrawal status: PAID
- Transaction logged

### Scenario 2: Already Paid

**Withdrawal Request:** PAID  
**Request:** `{ "withdrawalRequestId": "...", "paymentReference": "UTR123..." }`  
**Result:**
- ❌ Error: "Withdrawal request is already PAID. Only PENDING requests can be paid."

### Scenario 3: Insufficient Hold Balance

**Wallet:** holdBalance = 100.00  
**Withdrawal Request:** amount = 500.00  
**Result:**
- ❌ Error: "Insufficient hold balance. Hold balance: 100.00, Requested: 500.00"

### Scenario 4: Vendor Mismatch

**Withdrawal Request:** vendorId = "A"  
**Request:** `/api/admin/settlements/B/pay`  
**Result:**
- ❌ Error: "Withdrawal request does not belong to this vendor"

---

## Security & Best Practices

### Security

1. **Admin-Only Access:** Only admins and super-admins can process settlements
2. **Status Validation:** Only PENDING requests can be paid
3. **Vendor Validation:** Ensures withdrawal belongs to correct vendor
4. **Hold Balance Check:** Prevents over-payment

### Best Practices

1. **Transaction Safety:** Uses MongoDB transactions for atomicity
2. **Idempotency:** Status check prevents duplicate settlement
3. **Audit Trail:** Payment reference and admin info stored
4. **Transaction Logging:** All settlements logged in wallet
5. **Error Handling:** Comprehensive error messages

### Performance

1. **Indexes:** WithdrawalRequest model has indexes for fast queries
2. **Transactions:** Uses MongoDB sessions for efficient transaction handling
3. **Atomic Operations:** All wallet updates are atomic

---

## Settlement Flow Diagram

```
1. Admin Reviews Pending Withdrawals
   ↓
2. Admin Selects Withdrawal Request
   ↓
3. Admin Processes Bank Transfer
   ↓
4. Admin Calls Settlement API
   ↓
5. Validate Withdrawal (PENDING, vendor match)
   ↓
6. Check Hold Balance
   ↓
7. Update Wallet (holdBalance -= amount)
   ↓
8. Log Transaction
   ↓
9. Update Withdrawal (status = PAID)
   ↓
10. Store Payment Reference
    ↓
11. Return Success Response
```

---

## Integration with Withdrawal System

### Withdrawal Request Flow

1. **Vendor Requests:** Vendor creates withdrawal request (PENDING)
2. **Balance Held:** Amount moved to holdBalance
3. **Admin Reviews:** Admin reviews pending requests
4. **Admin Processes:** Admin processes bank transfer
5. **Settlement:** Admin calls settlement API
6. **Hold Released:** holdBalance decremented
7. **Status Updated:** Withdrawal marked as PAID

---

## Testing Checklist

- [ ] Process settlement with valid PENDING request
- [ ] Prevent settlement of non-PENDING requests
- [ ] Prevent settlement with vendor mismatch
- [ ] Prevent settlement with insufficient hold balance
- [ ] Hold balance decremented correctly
- [ ] Transaction logged correctly
- [ ] Withdrawal status updated to PAID
- [ ] Payment reference stored
- [ ] Admin info stored
- [ ] Authentication required
- [ ] Admin/Super Admin role validation
- [ ] Idempotency (prevent duplicate settlement)

---

## Future Enhancements

1. **Bulk Settlement:** Process multiple withdrawals at once
2. **Settlement History:** List all settlements for admin
3. **Settlement Reports:** Generate settlement reports
4. **Bank Integration:** Direct bank API integration
5. **Automated Settlement:** Scheduled automatic settlements
6. **Settlement Notifications:** Notify vendor on settlement
7. **Settlement Analytics:** Analytics dashboard
8. **Settlement Approval Workflow:** Multi-level approval
9. **Settlement Reversal:** Reverse incorrect settlements
10. **Settlement Export:** Export settlement data to CSV/Excel

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
- `400` - Bad Request (validation errors, status mismatch)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (role/permission denied)
- `404` - Not Found (withdrawal/wallet not found)
- `500` - Internal Server Error (server errors)

---

## Example Responses

### Successful Settlement

```json
{
  "success": true,
  "message": "Settlement completed successfully",
  "data": {
    "vendorId": "694129c27f75e93fd924715e",
    "withdrawalRequestId": "694129c27f75e93fd924715d",
    "amountPaid": 500.00,
    "paymentReference": "UTR12345678901234567890",
    "paidAt": "2024-01-15T10:30:00.000Z",
    "walletBalance": 1000.00,
    "remainingHoldBalance": 0.00
  }
}
```

### Already Paid Error

```json
{
  "success": false,
  "message": "Withdrawal request is already PAID. Only PENDING requests can be paid."
}
```

### Insufficient Hold Balance Error

```json
{
  "success": false,
  "message": "Insufficient hold balance. Hold balance: 100.00, Requested: 500.00"
}
```

