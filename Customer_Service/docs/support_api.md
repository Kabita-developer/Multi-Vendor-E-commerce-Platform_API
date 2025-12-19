# Customer Service / Support System API Documentation

## Overview

This document describes the Customer Service / Support System API for a Multi-Vendor E-commerce Platform. This system allows customers to raise support tickets, and allows Admin, Support staff, and Vendors to resolve them in a structured, trackable way.

**Base URLs:**
- Customer: `/api/support`
- Admin: `/api/admin/support`
- Vendor: `/api/vendor/support`

**Authentication:** All endpoints require JWT authentication with appropriate role.

---

## ROLES & ACCESS

### Customer
- Can create support tickets
- Can view own tickets
- Can reply to own tickets
- Cannot close tickets

### Vendor
- Can view tickets related to their orders/products
- Can reply to related tickets
- Cannot close tickets

### Admin / Super Admin
- Can view all tickets
- Can reply to any ticket
- Can close/resolve tickets
- Full access to all ticket operations

---

## TICKET LIFECYCLE

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
```

- **OPEN**: Ticket created, awaiting response
- **IN_PROGRESS**: Reply added, ticket is being handled
- **RESOLVED**: Issue resolved by admin
- **CLOSED**: Ticket closed (final state)

---

## TICKET CATEGORIES

- `order` - Order-related issues
- `payment` - Payment problems
- `refund` - Refund requests
- `product` - Product issues (damaged, wrong item, etc.)
- `account` - Account-related issues
- `general` - General inquiries

---

## TICKET PRIORITIES

- `low` - Low priority issues
- `medium` - Medium priority (default)
- `high` - High priority, urgent issues

---

# CUSTOMER ENDPOINTS

## CREATE SUPPORT TICKET

### Endpoint

`POST /api/support/tickets`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject` | String | Yes | Ticket subject/title |
| `category` | String | Yes | Ticket category (order, payment, refund, product, account, general) |
| `priority` | String | No | Priority level (low, medium, high) - Default: medium |
| `orderId` | String | No | Order ID (if ticket is related to an order) |
| `vendorId` | String | No | Vendor ID (if ticket is related to a vendor) |
| `message` | String | Yes | Initial message/description |

### Request Example

```json
{
  "subject": "Wrong product received",
  "category": "product",
  "priority": "high",
  "orderId": "694129c27f75e93fd924715d",
  "message": "I received a different product than what I ordered. Order number: ORD-12345"
}
```

### Success Response

**Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "Support ticket created successfully",
  "data": {
    "ticket": {
      "_id": "694451825059879c29428f9d",
      "ticketNumber": "TKT-ABC123-XYZ789",
      "customerId": {
        "_id": "694129c27f75e93fd924715e",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "orderId": {
        "_id": "694129c27f75e93fd924715d",
        "orderNumber": "ORD-12345"
      },
      "vendorId": {
        "_id": "693fcf4a1f6d99fd059e1a30",
        "shopName": "Electronics Store"
      },
      "subject": "Wrong product received",
      "category": "product",
      "priority": "medium",
      "status": "OPEN",
      "messages": [
        {
          "_id": "694451825059879c29428f9e",
          "senderRole": "customer",
          "senderId": "694129c27f75e93fd924715e",
          "text": "I received a different product than what I ordered. Order number: ORD-12345",
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### Error Responses

#### Missing Required Fields

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Subject, category, and message are required"
}
```

#### Invalid Order ID

**Status Code:** `400 Bad Request` or `404 Not Found`

```json
{
  "success": false,
  "message": "Order not found"
}
```

#### Order Not Owned by Customer

**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "You can only create tickets for your own orders"
}
```

---

## GET MY TICKETS

### Endpoint

`GET /api/support/tickets/my`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | String | No | Filter by status (OPEN, IN_PROGRESS, RESOLVED, CLOSED) |
| `category` | String | No | Filter by category |
| `page` | Number | No | Page number (default: 1) |
| `limit` | Number | No | Items per page (default: 10, max: 50) |

### Request Example

```bash
curl -X GET "http://localhost:3000/api/support/tickets/my?status=OPEN&page=1&limit=10" \
  -H "Authorization: Bearer <jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "_id": "694451825059879c29428f9d",
        "ticketNumber": "TKT-ABC123-XYZ789",
        "subject": "Wrong product received",
        "category": "product",
        "priority": "medium",
        "status": "OPEN",
        "orderId": {
          "_id": "694129c27f75e93fd924715d",
          "orderNumber": "ORD-12345"
        },
        "vendorId": {
          "_id": "693fcf4a1f6d99fd059e1a30",
          "shopName": "Electronics Store"
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

## GET TICKET BY ID

### Endpoint

`GET /api/support/tickets/:id`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Example

```bash
curl -X GET "http://localhost:3000/api/support/tickets/694451825059879c29428f9d" \
  -H "Authorization: Bearer <jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "ticket": {
      "_id": "694451825059879c29428f9d",
      "ticketNumber": "TKT-ABC123-XYZ789",
      "customerId": {
        "_id": "694129c27f75e93fd924715e",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "orderId": {
        "_id": "694129c27f75e93fd924715d",
        "orderNumber": "ORD-12345",
        "subTotal": 1500.00,
        "payableAmount": 1500.00
      },
      "vendorId": {
        "_id": "693fcf4a1f6d99fd059e1a30",
        "shopName": "Electronics Store",
        "email": "vendor@example.com"
      },
      "subject": "Wrong product received",
      "category": "product",
      "priority": "medium",
      "status": "IN_PROGRESS",
      "messages": [
        {
          "_id": "694451825059879c29428f9e",
          "senderRole": "customer",
          "senderId": "694129c27f75e93fd924715e",
          "text": "I received a different product than what I ordered.",
          "createdAt": "2024-01-15T10:30:00.000Z"
        },
        {
          "_id": "694451825059879c29428f9f",
          "senderRole": "admin",
          "senderId": "694129c27f75e93fd924715f",
          "text": "We apologize for the inconvenience. We'll process a replacement immediately.",
          "createdAt": "2024-01-15T11:00:00.000Z"
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  }
}
```

### Error Responses

#### Ticket Not Found

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Ticket not found"
}
```

#### Access Denied

**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "Access denied. You can only view your own tickets."
}
```

---

## REPLY TO TICKET (CUSTOMER)

### Endpoint

`POST /api/support/tickets/:id/reply`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | String | Yes | Reply message |

### Request Example

```json
{
  "message": "Thank you for the quick response. I'll wait for the replacement."
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Reply added successfully",
  "data": {
    "ticket": {
      "_id": "694451825059879c29428f9d",
      "ticketNumber": "TKT-ABC123-XYZ789",
      "status": "IN_PROGRESS",
      "messages": [
        {
          "senderRole": "customer",
          "text": "I received a different product than what I ordered.",
          "createdAt": "2024-01-15T10:30:00.000Z"
        },
        {
          "senderRole": "admin",
          "text": "We apologize for the inconvenience.",
          "createdAt": "2024-01-15T11:00:00.000Z"
        },
        {
          "senderRole": "customer",
          "text": "Thank you for the quick response. I'll wait for the replacement.",
          "createdAt": "2024-01-15T11:30:00.000Z"
        }
      ]
    }
  }
}
```

### Error Responses

#### Ticket Closed

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Cannot reply to a closed ticket"
}
```

---

# ADMIN ENDPOINTS

## GET ALL TICKETS

### Endpoint

`GET /api/admin/support/tickets`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | String | No | Filter by status |
| `category` | String | No | Filter by category |
| `priority` | String | No | Filter by priority |
| `customerId` | String | No | Filter by customer ID |
| `vendorId` | String | No | Filter by vendor ID |
| `orderId` | String | No | Filter by order ID |
| `page` | Number | No | Page number (default: 1) |
| `limit` | Number | No | Items per page (default: 20, max: 50) |

### Request Example

```bash
curl -X GET "http://localhost:3000/api/admin/support/tickets?status=OPEN&page=1&limit=20" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "_id": "694451825059879c29428f9d",
        "ticketNumber": "TKT-ABC123-XYZ789",
        "customerId": {
          "_id": "694129c27f75e93fd924715e",
          "name": "John Doe",
          "email": "john@example.com",
          "phone": "9876543210"
        },
        "orderId": {
          "_id": "694129c27f75e93fd924715d",
          "orderNumber": "ORD-12345",
          "subTotal": 1500.00,
          "payableAmount": 1500.00
        },
        "vendorId": {
          "_id": "693fcf4a1f6d99fd059e1a30",
          "shopName": "Electronics Store",
          "email": "vendor@example.com"
        },
        "subject": "Wrong product received",
        "category": "product",
        "priority": "high",
        "status": "OPEN",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    },
    "statistics": {
      "byStatus": {
        "OPEN": 10,
        "IN_PROGRESS": 8,
        "RESOLVED": 5,
        "CLOSED": 2
      }
    }
  }
}
```

---

## REPLY TO TICKET (ADMIN)

### Endpoint

`POST /api/admin/support/tickets/:id/reply`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | String | Yes | Reply message |

### Request Example

```json
{
  "message": "We've processed your refund. It will reflect in your account within 3-5 business days."
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Reply added successfully",
  "data": {
    "ticket": {
      "_id": "694451825059879c29428f9d",
      "status": "IN_PROGRESS",
      "messages": [
        {
          "senderRole": "customer",
          "text": "I want a refund for this order.",
          "createdAt": "2024-01-15T10:30:00.000Z"
        },
        {
          "senderRole": "admin",
          "text": "We've processed your refund. It will reflect in your account within 3-5 business days.",
          "createdAt": "2024-01-15T12:00:00.000Z"
        }
      ]
    }
  }
}
```

---

## CLOSE TICKET (ADMIN)

### Endpoint

`PUT /api/admin/support/tickets/:id/close`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Admin or Super Admin
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | String | No | Either "RESOLVED" or "CLOSED" (default: "CLOSED") |

### Request Example

```json
{
  "status": "RESOLVED"
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Ticket resolved successfully",
  "data": {
    "ticket": {
      "_id": "694451825059879c29428f9d",
      "ticketNumber": "TKT-ABC123-XYZ789",
      "status": "RESOLVED",
      "resolvedAt": "2024-01-15T13:00:00.000Z",
      "resolvedBy": "694129c27f75e93fd924715f"
    }
  }
}
```

---

# VENDOR ENDPOINTS

## GET VENDOR TICKETS

### Endpoint

`GET /api/vendor/support/tickets`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | String | No | Filter by status |
| `category` | String | No | Filter by category |
| `page` | Number | No | Page number (default: 1) |
| `limit` | Number | No | Items per page (default: 10, max: 50) |

### Request Example

```bash
curl -X GET "http://localhost:3000/api/vendor/support/tickets?status=OPEN" \
  -H "Authorization: Bearer <vendor-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "_id": "694451825059879c29428f9d",
        "ticketNumber": "TKT-ABC123-XYZ789",
        "customerId": {
          "_id": "694129c27f75e93fd924715e",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "orderId": {
          "_id": "694129c27f75e93fd924715d",
          "orderNumber": "ORD-12345"
        },
        "subject": "Wrong product received",
        "category": "product",
        "priority": "high",
        "status": "OPEN",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 3,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

## REPLY TO TICKET (VENDOR)

### Endpoint

`POST /api/vendor/support/tickets/:id/reply`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | String | Yes | Reply message |

### Request Example

```json
{
  "message": "We apologize for the mix-up. We'll send the correct product immediately."
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Reply added successfully",
  "data": {
    "ticket": {
      "_id": "694451825059879c29428f9d",
      "status": "IN_PROGRESS",
      "messages": [
        {
          "senderRole": "customer",
          "text": "I received a different product than what I ordered.",
          "createdAt": "2024-01-15T10:30:00.000Z"
        },
        {
          "senderRole": "vendor",
          "text": "We apologize for the mix-up. We'll send the correct product immediately.",
          "createdAt": "2024-01-15T11:00:00.000Z"
        }
      ]
    }
  }
}
```

### Error Responses

#### Access Denied

**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "message": "Access denied. You can only reply to tickets related to your orders/products."
}
```

---

## Database Schema

### SupportTicket Model

```javascript
{
  ticketNumber: String,        // Unique ticket number (e.g., TKT-ABC123-XYZ789)
  customerId: ObjectId,        // Reference to Customer
  orderId: ObjectId,           // Reference to Order (optional)
  vendorId: ObjectId,          // Reference to Vendor (optional)
  subject: String,             // Ticket subject/title
  category: String,             // order, payment, refund, product, account, general
  priority: String,             // low, medium, high
  status: String,               // OPEN, IN_PROGRESS, RESOLVED, CLOSED
  messages: [
    {
      senderRole: String,       // customer, admin, super-admin, vendor
      senderId: ObjectId,       // ID of sender
      text: String,             // Message content
      createdAt: Date
    }
  ],
  resolvedAt: Date,             // When ticket was resolved
  closedAt: Date,               // When ticket was closed
  resolvedBy: ObjectId,         // Admin who resolved
  closedBy: ObjectId,           // Admin who closed
  createdAt: Date,
  updatedAt: Date
}
```

---

## Business Rules

### Ticket Creation

1. **Status**: New tickets start with status `OPEN`
2. **Order Validation**: If `orderId` is provided, it must belong to the customer
3. **Vendor Auto-assignment**: If `orderId` is provided, `vendorId` is automatically set from the order
4. **Ticket Number**: Auto-generated unique ticket number (format: `TKT-{timestamp}-{random}`)

### Ticket Status Transitions

1. **OPEN → IN_PROGRESS**: Automatically when any reply is added
2. **IN_PROGRESS → RESOLVED**: Admin marks as resolved
3. **RESOLVED → CLOSED**: Admin closes the ticket
4. **Any → CLOSED**: Admin can directly close any ticket

### Access Control

1. **Customer**: Can only access own tickets
2. **Vendor**: Can only access tickets related to their orders/products
3. **Admin**: Full access to all tickets

### Reply Rules

1. **Customer**: Can reply to own tickets (if not closed)
2. **Vendor**: Can reply to related tickets (if not closed)
3. **Admin**: Can reply to any ticket (if not closed)
4. **Status Update**: First reply moves status from `OPEN` to `IN_PROGRESS`

### Ticket Closure

1. **Only Admin**: Only admins can close/resolve tickets
2. **Cannot Reply**: Closed tickets cannot receive new replies
3. **Resolved First**: If closing, ticket is marked as resolved first (if not already)

---

## Security & Best Practices

1. **JWT Authentication**: All endpoints require valid JWT token
2. **Role-Based Access**: Middleware enforces role-based access control
3. **Ownership Validation**: Customers can only access their own tickets
4. **Vendor Filtering**: Vendors only see tickets related to their orders
5. **Input Validation**: All inputs are validated before processing
6. **Error Handling**: Comprehensive error handling with clear messages
7. **Pagination**: All list endpoints support pagination
8. **Indexing**: Database indexes for optimal query performance

---

## Example Use Cases

### Use Case 1: Customer Reports Wrong Product

1. Customer creates ticket with `orderId` and `category: "product"`
2. Ticket automatically linked to vendor from order
3. Vendor receives notification (future enhancement)
4. Vendor replies with solution
5. Admin resolves ticket when issue is fixed

### Use Case 2: Payment Issue

1. Customer creates ticket with `category: "payment"` and `orderId`
2. Admin reviews payment details
3. Admin replies with resolution
4. Admin marks ticket as RESOLVED
5. Admin closes ticket after confirmation

### Use Case 3: Refund Request

1. Customer creates ticket with `category: "refund"` and `orderId`
2. Admin reviews order and processes refund
3. Admin replies confirming refund
4. Admin marks ticket as RESOLVED
5. Customer confirms receipt
6. Admin closes ticket

---

## Future Enhancements

1. **Email Notifications**: Send email notifications on ticket updates
2. **File Attachments**: Allow customers to attach images/files to tickets
3. **Ticket Assignment**: Assign tickets to specific support staff
4. **SLA Tracking**: Track response times and SLA compliance
5. **Ticket Templates**: Pre-defined templates for common issues
6. **Internal Notes**: Allow admins to add internal notes (not visible to customers)
7. **Ticket Escalation**: Automatic escalation for high-priority tickets
8. **Analytics Dashboard**: Support ticket analytics and metrics
9. **Search Functionality**: Advanced search across tickets
10. **Ticket Tags**: Add tags for better organization

---

## Support

For issues or questions, please contact the development team or refer to the main API documentation.

