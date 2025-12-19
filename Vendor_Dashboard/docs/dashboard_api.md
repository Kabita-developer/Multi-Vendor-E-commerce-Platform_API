# Vendor Dashboard API Documentation

## Overview

This document describes the Vendor Dashboard API for viewing vendor-specific business metrics. This API allows authenticated vendors to view their order statistics, earnings, and wallet balance.

**Base URL:** `/api/vendor`

**Authentication:** All dashboard endpoints require JWT authentication with vendor role.

---

## GET VENDOR DASHBOARD

### Endpoint

`GET /api/vendor/dashboard`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated vendors can view their own dashboard
- Vendor ID is extracted from JWT token
- Vendor must be approved to access dashboard

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### Request Example

```bash
curl -X GET http://localhost:3000/api/vendor/dashboard \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Controller Logic (Step by Step)

1. **Authenticate vendor** using JWT token (via middleware)
2. **Extract vendorId** from authenticated token
3. **Calculate order statistics** using MongoDB aggregation:
   - Group orders by `orderStatus`
   - Count orders per status
   - Calculate total amount per status
4. **Calculate earnings** from CONFIRMED and DELIVERED orders:
   - Sum of `commission.vendorAmount` (vendor earnings)
   - Sum of `subTotal` (total sales)
   - Count of orders
   - Sum of `commission.platformAmount` (platform commission)
5. **Fetch wallet balance** from VendorWallet:
   - Available balance
   - Hold balance (pending withdrawals)
   - Total balance
   - Total transactions count
6. **Return dashboard response**

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "orders": {
      "total": 150,
      "pending": 5,
      "confirmed": 20,
      "packed": 15,
      "shipped": 30,
      "delivered": 70,
      "cancelled": 10,
      "byStatus": {
        "PENDING": {
          "count": 5,
          "totalAmount": 2500.00
        },
        "CONFIRMED": {
          "count": 20,
          "totalAmount": 15000.00
        },
        "PACKED": {
          "count": 15,
          "totalAmount": 12000.00
        },
        "SHIPPED": {
          "count": 30,
          "totalAmount": 25000.00
        },
        "DELIVERED": {
          "count": 70,
          "totalAmount": 85000.00
        },
        "CANCELLED": {
          "count": 10,
          "totalAmount": 5000.00
        }
      }
    },
    "earnings": {
      "totalEarnings": 76500.00,
      "totalSales": 85000.00,
      "totalOrders": 90,
      "platformCommission": 8500.00
    },
    "wallet": {
      "availableBalance": 50000.00,
      "holdBalance": 5000.00,
      "totalBalance": 55000.00,
      "totalTransactions": 85
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `data` | Object | Dashboard data |
| `data.orders` | Object | Order statistics |
| `data.orders.total` | Number | Total number of orders |
| `data.orders.pending` | Number | Count of PENDING orders |
| `data.orders.confirmed` | Number | Count of CONFIRMED orders |
| `data.orders.packed` | Number | Count of PACKED orders |
| `data.orders.shipped` | Number | Count of SHIPPED orders |
| `data.orders.delivered` | Number | Count of DELIVERED orders |
| `data.orders.cancelled` | Number | Count of CANCELLED orders |
| `data.orders.byStatus` | Object | Detailed breakdown by status |
| `data.orders.byStatus[STATUS]` | Object | Status-specific data |
| `data.orders.byStatus[STATUS].count` | Number | Order count for this status |
| `data.orders.byStatus[STATUS].totalAmount` | Number | Total amount for this status |
| `data.earnings` | Object | Earnings statistics |
| `data.earnings.totalEarnings` | Number | Total vendor earnings (from commission.vendorAmount) |
| `data.earnings.totalSales` | Number | Total sales amount (sum of subTotal) |
| `data.earnings.totalOrders` | Number | Total CONFIRMED and DELIVERED orders |
| `data.earnings.platformCommission` | Number | Total platform commission deducted |
| `data.wallet` | Object | Wallet balance information |
| `data.wallet.availableBalance` | Number | Available balance (can be withdrawn) |
| `data.wallet.holdBalance` | Number | Balance on hold (pending withdrawals) |
| `data.wallet.totalBalance` | Number | Total balance (available + hold) |
| `data.wallet.totalTransactions` | Number | Total number of wallet transactions |

### Error Responses

#### Missing Authorization Header

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

#### Invalid Token

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

#### Vendor Not Approved

**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "Vendor account is not approved. Current status: pending"
}
```

#### Server Error

**Status Code:** `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Failed to fetch dashboard data"
}
```

---

## Database Schema

### Order Model (Relevant Fields)

```javascript
{
  vendorId: ObjectId,
  orderStatus: String,        // PENDING, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED
  subTotal: Number,
  commission: {
    vendorAmount: Number,     // Vendor earnings
    platformAmount: Number    // Platform commission
  },
  createdAt: Date
}
```

### VendorWallet Model (Relevant Fields)

```javascript
{
  vendorId: ObjectId,
  balance: Number,            // Available balance
  holdBalance: Number,        // Balance on hold (pending withdrawals)
  transactions: [
    {
      type: String,           // "CREDIT" or "DEBIT"
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

## Metrics Calculation

### Order Statistics

**Formula:**
```
orders.total = COUNT(*) WHERE vendorId = X
orders[STATUS] = COUNT(*) WHERE vendorId = X AND orderStatus = STATUS
orders.byStatus[STATUS].totalAmount = SUM(subTotal) WHERE vendorId = X AND orderStatus = STATUS
```

**Implementation:**
- Uses MongoDB aggregation `$group` operator
- Groups by `orderStatus`
- Counts orders and sums `subTotal` per status

### Earnings

**Formula:**
```
totalEarnings = SUM(commission.vendorAmount) WHERE vendorId = X AND orderStatus IN ["CONFIRMED", "DELIVERED"]
totalSales = SUM(subTotal) WHERE vendorId = X AND orderStatus IN ["CONFIRMED", "DELIVERED"]
totalOrders = COUNT(*) WHERE vendorId = X AND orderStatus IN ["CONFIRMED", "DELIVERED"]
platformCommission = SUM(commission.platformAmount) WHERE vendorId = X AND orderStatus IN ["CONFIRMED", "DELIVERED"]
```

**Implementation:**
- Uses MongoDB aggregation `$match` and `$group` operators
- Filters orders by status (CONFIRMED, DELIVERED)
- Sums vendor earnings and platform commission
- Handles null values with `$ifNull`

### Wallet Balance

**Formula:**
```
availableBalance = wallet.balance
holdBalance = wallet.holdBalance
totalBalance = wallet.balance + wallet.holdBalance
totalTransactions = COUNT(wallet.transactions)
```

**Implementation:**
- Fetches VendorWallet document by vendorId
- Extracts balance, holdBalance, and transactions array length
- Returns 0 if wallet doesn't exist

---

## Aggregation Pipeline

### Order Statistics Aggregation

```javascript
Order.aggregate([
  {
    $match: {
      vendorId: vendorObjectId
    }
  },
  {
    $group: {
      _id: '$orderStatus',
      count: { $sum: 1 },
      totalAmount: { $sum: '$subTotal' }
    }
  }
])
```

### Earnings Aggregation

```javascript
Order.aggregate([
  {
    $match: {
      vendorId: vendorObjectId,
      orderStatus: { $in: ['CONFIRMED', 'DELIVERED'] }
    }
  },
  {
    $group: {
      _id: null,
      totalEarnings: {
        $sum: {
          $ifNull: ['$commission.vendorAmount', 0]
        }
      },
      totalSales: { $sum: '$subTotal' },
      totalOrders: { $sum: 1 },
      platformCommission: {
        $sum: {
          $ifNull: ['$commission.platformAmount', 0]
        }
      }
    }
  }
])
```

---

## Business Rules

### Order Statistics

1. **All Orders:** Includes all orders regardless of status
2. **Status Breakdown:** Provides count and total amount per status
3. **Real-time Data:** Reflects current order statuses

### Earnings Calculation

1. **Confirmed Orders Only:** Only CONFIRMED and DELIVERED orders contribute to earnings
2. **Commission-Based:** Earnings calculated from `commission.vendorAmount` snapshot
3. **Sales Amount:** Total sales from `subTotal` of confirmed/delivered orders
4. **Platform Commission:** Shows total commission deducted by platform

### Wallet Balance

1. **Available Balance:** Amount vendor can withdraw immediately
2. **Hold Balance:** Amount locked due to pending withdrawal requests
3. **Total Balance:** Sum of available and hold balance
4. **Transaction History:** Count of all wallet transactions

---

## Notes

1. **Aggregation-Based:** Uses MongoDB aggregation for efficient data processing
2. **Precision:** All amounts rounded to 2 decimal places
3. **Performance:** Optimized with indexes on `vendorId` and `orderStatus`
4. **Real-time:** Data reflects current database state
5. **Vendor Isolation:** Each vendor only sees their own data

---

## Example Use Cases

### Use Case 1: View Dashboard Overview

**Scenario:** Vendor wants to see overall business performance

**Request:**
```bash
GET /api/vendor/dashboard
Authorization: Bearer <vendor-jwt-token>
```

**Response:** Returns complete dashboard with orders, earnings, and wallet balance

### Use Case 2: Check Order Status Distribution

**Scenario:** Vendor wants to see how many orders are in each status

**Response Section:**
```json
{
  "orders": {
    "pending": 5,
    "confirmed": 20,
    "packed": 15,
    "shipped": 30,
    "delivered": 70,
    "cancelled": 10
  }
}
```

### Use Case 3: Monitor Earnings

**Scenario:** Vendor wants to see total earnings and sales

**Response Section:**
```json
{
  "earnings": {
    "totalEarnings": 76500.00,
    "totalSales": 85000.00,
    "totalOrders": 90,
    "platformCommission": 8500.00
  }
}
```

### Use Case 4: Check Wallet Balance

**Scenario:** Vendor wants to see available balance for withdrawal

**Response Section:**
```json
{
  "wallet": {
    "availableBalance": 50000.00,
    "holdBalance": 5000.00,
    "totalBalance": 55000.00,
    "totalTransactions": 85
  }
}
```

---

## Future Enhancements

1. **Time-based Filtering:** Add date range filters for orders and earnings
2. **Graph Data:** Return data formatted for charts (daily/weekly/monthly trends)
3. **Top Products:** Include best-selling products in dashboard
4. **Recent Orders:** Add list of recent orders with details
5. **Performance Metrics:** Add conversion rates, average order value, etc.
6. **Export Functionality:** Allow vendors to export dashboard data as CSV/PDF

---

## Related APIs

- **GET /api/commission/wallet** - Get detailed wallet information
- **GET /api/vendor/orders** - List vendor orders
- **POST /api/vendor/wallet/withdraw** - Request withdrawal from wallet
- **GET /api/admin/dashboard** - Admin dashboard (all vendors)

---

## Support

For issues or questions, please contact the development team or refer to the main API documentation.

