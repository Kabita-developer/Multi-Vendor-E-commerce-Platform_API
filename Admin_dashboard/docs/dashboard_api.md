# Admin Dashboard API Documentation

## Overview

This document describes the Admin Dashboard API. This API provides high-level business metrics for admins and super-admins, including total sales, platform profit, and vendor performance analytics.

**Base URL:** `/api/admin`

**Authentication:** All dashboard endpoints require JWT authentication with admin or super-admin role.

---

## GET DASHBOARD METRICS

### Endpoint

`GET /api/admin/dashboard`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only admins and super-admins can access dashboard
- Returns aggregate metrics from CONFIRMED and DELIVERED orders
- Uses MongoDB aggregation for efficient data processing

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### Request Example

```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### Controller Logic (Step by Step)

1. **Authenticate user** using JWT token
2. **Ensure role** is admin or super-admin
3. **Calculate overall stats** using aggregation:
   - `totalSales = sum(subTotal)` from CONFIRMED & DELIVERED orders
   - `platformProfit = sum(commission.platformAmount)` from same orders
4. **Aggregate vendor performance** using aggregation:
   - Group orders by `vendorId`
   - Calculate per vendor:
     - `totalSales = sum(subTotal)`
     - `totalOrders = count(orders)`
     - `platformProfit = sum(commission.platformAmount)`
5. **Fetch vendor details** (shopName) for all vendors
6. **Sort vendors** by totalSales (descending)
7. **Return dashboard response**

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "stats": {
    "totalSales": 250000.00,
    "platformProfit": 28000.00
  },
  "vendorPerformance": [
    {
      "vendorId": "694129c27f75e93fd924715e",
      "shopName": "Star Rice Store",
      "totalSales": 85000.00,
      "totalOrders": 110,
      "platformProfit": 8500.00
    },
    {
      "vendorId": "694129c27f75e93fd924715f",
      "shopName": "Fresh Vegetables",
      "totalSales": 75000.00,
      "totalOrders": 95,
      "platformProfit": 7500.00
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `stats` | Object | Overall platform statistics |
| `stats.totalSales` | Number | Total sales from CONFIRMED & DELIVERED orders |
| `stats.platformProfit` | Number | Total platform commission/profit |
| `vendorPerformance` | Array | Vendor performance metrics (sorted by totalSales) |
| `vendorPerformance[].vendorId` | String | Vendor ID |
| `vendorPerformance[].shopName` | String | Vendor shop name |
| `vendorPerformance[].totalSales` | Number | Total sales for this vendor |
| `vendorPerformance[].totalOrders` | Number | Total number of orders for this vendor |
| `vendorPerformance[].platformProfit` | Number | Platform profit from this vendor |

### Error Responses

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

#### Server Error
**Status Code:** `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Failed to fetch dashboard data"
}
```

### Notes

1. **Aggregation-Based:** Uses MongoDB aggregation for efficient data processing
2. **Order Status Filter:** Only includes CONFIRMED and DELIVERED orders
3. **Sorted Results:** Vendors sorted by totalSales (descending)
4. **Precision:** All amounts rounded to 2 decimal places
5. **Performance:** Optimized with indexes on `orderStatus` and `vendorId`

---

## Database Schema

### Order Model (Relevant Fields)

```javascript
{
  vendorId: ObjectId,
  subTotal: Number,
  orderStatus: String,        // CONFIRMED, DELIVERED
  commission: {
    platformAmount: Number,
    vendorAmount: Number
  },
  createdAt: Date
}
```

### Vendor Model (Relevant Fields)

```javascript
{
  _id: ObjectId,
  shopName: String
}
```

---

## Metrics Calculation

### Total Sales

**Formula:**
```
totalSales = SUM(subTotal) WHERE orderStatus IN ["CONFIRMED", "DELIVERED"]
```

**Implementation:**
- Uses MongoDB aggregation `$sum` operator
- Filters orders by status
- Sums all `subTotal` values

### Platform Profit

**Formula:**
```
platformProfit = SUM(commission.platformAmount) WHERE orderStatus IN ["CONFIRMED", "DELIVERED"]
```

**Implementation:**
- Uses MongoDB aggregation `$sum` operator
- Filters orders by status
- Sums all `commission.platformAmount` values
- Handles null values with `$ifNull`

### Vendor Performance

**Formula (per vendor):**
```
totalSales = SUM(subTotal) WHERE vendorId = X AND orderStatus IN ["CONFIRMED", "DELIVERED"]
totalOrders = COUNT(*) WHERE vendorId = X AND orderStatus IN ["CONFIRMED", "DELIVERED"]
platformProfit = SUM(commission.platformAmount) WHERE vendorId = X AND orderStatus IN ["CONFIRMED", "DELIVERED"]
```

**Implementation:**
- Uses MongoDB aggregation `$group` operator
- Groups by `vendorId`
- Calculates sums and counts
- Sorts by `totalSales` descending

---

## Aggregation Pipeline

### Overall Stats Aggregation

```javascript
Order.aggregate([
  {
    $match: {
      orderStatus: { $in: ['CONFIRMED', 'DELIVERED'] }
    }
  },
  {
    $group: {
      _id: null,
      totalSales: { $sum: '$subTotal' },
      platformProfit: {
        $sum: {
          $ifNull: ['$commission.platformAmount', 0]
        }
      }
    }
  }
])
```

### Vendor Performance Aggregation

```javascript
Order.aggregate([
  {
    $match: {
      orderStatus: { $in: ['CONFIRMED', 'DELIVERED'] }
    }
  },
  {
    $group: {
      _id: '$vendorId',
      totalSales: { $sum: '$subTotal' },
      totalOrders: { $sum: 1 },
      platformProfit: {
        $sum: {
          $ifNull: ['$commission.platformAmount', 0]
        }
      }
    }
  },
  {
    $sort: { totalSales: -1 }
  }
])
```

---

## Business Rules

### Order Status Filter

1. **Included Statuses:** Only CONFIRMED and DELIVERED orders are included
2. **Excluded Statuses:** PENDING, PACKED, SHIPPED, CANCELLED orders are excluded
3. **Reason:** Only completed orders contribute to sales and profit metrics

### Commission Calculation

1. **Platform Profit:** Sum of `commission.platformAmount` from all included orders
2. **Null Handling:** Orders without commission are treated as 0
3. **Accuracy:** Uses exact commission amounts from order snapshots

### Vendor Performance

1. **Grouping:** Orders grouped by `vendorId`
2. **Metrics:** Each vendor gets totalSales, totalOrders, and platformProfit
3. **Sorting:** Vendors sorted by totalSales (highest first)
4. **Vendor Details:** shopName populated from Vendor collection

---

## Example Scenarios

### Scenario 1: Empty Dashboard

**Orders:** None with CONFIRMED or DELIVERED status  
**Result:**
```json
{
  "success": true,
  "stats": {
    "totalSales": 0,
    "platformProfit": 0
  },
  "vendorPerformance": []
}
```

### Scenario 2: Single Vendor

**Orders:** 10 CONFIRMED orders, total subTotal = 10000, platformProfit = 1000  
**Result:**
```json
{
  "success": true,
  "stats": {
    "totalSales": 10000.00,
    "platformProfit": 1000.00
  },
  "vendorPerformance": [
    {
      "vendorId": "...",
      "shopName": "Vendor Name",
      "totalSales": 10000.00,
      "totalOrders": 10,
      "platformProfit": 1000.00
    }
  ]
}
```

### Scenario 3: Multiple Vendors

**Orders:** Multiple vendors with varying sales  
**Result:** Vendors sorted by totalSales (descending)

---

## Security & Best Practices

### Security

1. **Admin-Only Access:** Only admins and super-admins can access dashboard
2. **JWT Authentication:** All requests require valid JWT token
3. **Role Validation:** Role checked in middleware

### Best Practices

1. **Aggregation-Based:** Uses MongoDB aggregation (no heavy loops)
2. **Indexed Queries:** Leverages indexes on `orderStatus` and `vendorId`
3. **Efficient Processing:** Single aggregation pipeline for vendor metrics
4. **Precision:** All amounts rounded to 2 decimal places
5. **Error Handling:** Comprehensive error handling

### Performance

1. **Indexes:** Order model has indexes on `orderStatus` and `vendorId`
2. **Aggregation:** Uses MongoDB aggregation for efficient data processing
3. **Selective Fields:** Only fetches required vendor fields (shopName)
4. **Single Query:** Vendor details fetched in single query

---

## Dashboard Use Cases

### 1. Business Overview

- View total platform sales
- View total platform profit
- Understand overall business health

### 2. Vendor Analysis

- Identify top-performing vendors
- Compare vendor sales and orders
- Analyze vendor contribution to platform profit

### 3. Performance Monitoring

- Track sales trends
- Monitor platform profitability
- Identify growth opportunities

---

## Testing Checklist

- [ ] Get dashboard with valid admin token
- [ ] Prevent access with vendor token
- [ ] Prevent access with customer token
- [ ] Calculate total sales correctly
- [ ] Calculate platform profit correctly
- [ ] Aggregate vendor performance correctly
- [ ] Sort vendors by totalSales
- [ ] Handle empty orders gracefully
- [ ] Handle null commission values
- [ ] Round amounts to 2 decimal places

---

## Future Enhancements

1. **Date Range Filter:** Filter metrics by date range
2. **Time Period Comparison:** Compare metrics across time periods
3. **Additional Metrics:** Order count, average order value, etc.
4. **Vendor Rankings:** Top N vendors, growth rate, etc.
5. **Category Analytics:** Sales by category
6. **Geographic Analytics:** Sales by location
7. **Trend Analysis:** Sales trends over time
8. **Export Functionality:** Export dashboard data to CSV/Excel
9. **Real-Time Updates:** WebSocket support for real-time metrics
10. **Custom Dashboards:** Configurable dashboard widgets

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
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (role/permission denied)
- `500` - Internal Server Error (server errors)

---

## Example Responses

### Successful Dashboard Response

```json
{
  "success": true,
  "stats": {
    "totalSales": 250000.00,
    "platformProfit": 28000.00
  },
  "vendorPerformance": [
    {
      "vendorId": "694129c27f75e93fd924715e",
      "shopName": "Star Rice Store",
      "totalSales": 85000.00,
      "totalOrders": 110,
      "platformProfit": 8500.00
    },
    {
      "vendorId": "694129c27f75e93fd924715f",
      "shopName": "Fresh Vegetables",
      "totalSales": 75000.00,
      "totalOrders": 95,
      "platformProfit": 7500.00
    },
    {
      "vendorId": "694129c27f75e93fd9247160",
      "shopName": "Organic Foods",
      "totalSales": 50000.00,
      "totalOrders": 65,
      "platformProfit": 5000.00
    }
  ]
}
```

### Empty Dashboard Response

```json
{
  "success": true,
  "stats": {
    "totalSales": 0,
    "platformProfit": 0
  },
  "vendorPerformance": []
}
```

