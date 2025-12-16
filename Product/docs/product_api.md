# Product API Documentation

## Overview

This document describes the Product management APIs for vendors. Products are core entities that vendors can create and manage in the e-commerce platform.

**Base URL:** `/api/vendor/products`

**Authentication:** All product endpoints require JWT authentication with vendor role and approved status.

---

## CREATE PRODUCT

### Endpoint

`POST /api/vendor/products`

### Request Type

`multipart/form-data`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Status:** Vendor must be APPROVED
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated vendors can create products
- Vendor must be APPROVED (status = 'approved')
- `vendorId` is automatically extracted from JWT token (never from request body)
- Admin will have separate APIs to view all products

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

### Request Body Fields

#### Text Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | Yes | Product name |
| `description` | String | No | Product description |
| `price` | Number | Yes | Product price (must be >= 0) |
| `discountPrice` | Number | No | Discounted price (must be < price and >= 0) |
| `categoryId` | String | Yes | Category ID (must be active) |
| `subCategoryId` | String | No | Sub-category ID (must be active and belong to the provided categoryId) |
| `brandId` | String | No | Brand ID (must be active if provided) |
| `stock` | Number | Yes | Stock quantity (must be >= 0) |

#### File Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mainImage` | File | Yes | Primary product image (automatically resized to 3 sizes: original, 100px, 200px width) |
| `media` | File[] | No | Multiple images & videos (bulk upload, max 20 files). Use the same field name `media` for all files. |

#### Supported File Types

**Images:**
- JPG / JPEG
- PNG
- WebP

**Videos:**
- MP4
- MOV
- WebM

**File Size Limits:**
- Maximum file size: 50MB per file
- Maximum media files: 20

### Request Example (cURL)

```bash
curl -X POST http://localhost:3000/api/vendor/products \
  -H "Authorization: Bearer <your-jwt-token>" \
  -F "name=iPhone 15 Pro" \
  -F "description=Latest iPhone with advanced features" \
  -F "price=999.99" \
  -F "discountPrice=899.99" \
  -F "categoryId=693fbef1493989b8b80a31a6" \
  -F "subCategoryId=693fbef1493989b8b80a31a8" \
  -F "brandId=693fbef1493989b8b80a31a7" \
  -F "stock=50" \
  -F "mainImage=@/path/to/main-image.jpg" \
  -F "media=@/path/to/image1.jpg" \
  -F "media=@/path/to/image2.png" \
  -F "media=@/path/to/video.mp4"
```

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Product added successfully",
  "data": {
    "productId": "6940f8abd572703fbcec42dc"
  }
}
```

### Error Responses

| Status Code | Description | Example Message |
|------------|-------------|-----------------|
| 400 | Bad Request | "Product name is required and must be a non-empty string" |
| 400 | Bad Request | "Price must be a valid number greater than or equal to 0" |
| 400 | Bad Request | "Discount price must be less than the regular price" |
| 400 | Bad Request | "Stock must be a valid number greater than or equal to 0" |
| 400 | Bad Request | "Main image is required" |
| 400 | Bad Request | "Invalid file type. Only JPG, PNG, WebP images and MP4, MOV, WebM videos are allowed." |
| 400 | Bad Request | "File size too large. Maximum size is 50MB per file." |
| 401 | Unauthorized | "Authentication token required" |
| 403 | Forbidden | "Vendor account is not approved. Current status: pending" |
| 400 | Bad Request | "Sub-category not found or does not belong to the provided category" |
| 400 | Bad Request | "Cannot assign product to an inactive sub-category" |
| 404 | Not Found | "Category not found" |
| 404 | Not Found | "Brand not found" |
| 500 | Internal Server Error | "Failed to upload main image to S3" |

### Error Response Format

```json
{
  "success": false,
  "message": "Clear error message"
}
```

---

## UPDATE PRODUCT

### Endpoint

`POST /api/vendor/products/:productId/update`

### Request Type

`multipart/form-data` (supports updating text fields only, or text + files)

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Vendor
- **Status:** Vendor must be APPROVED
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Vendor can update **only their own products**
- `vendorId` is taken from JWT, not from the body

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

### Request Body Fields

All fields are **optional** – only provided fields will be updated.

#### Text Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | No | Product name |
| `description` | String | No | Product description |
| `price` | Number | No | Product price (must be >= 0) |
| `discountPrice` | Number | No | Discounted price (must be < price and >= 0) |
| `categoryId` | String | No | Category ID (must be active) |
| `subCategoryId` | String | No | Sub-category ID (must be active and belong to the provided categoryId) |
| `brandId` | String | No | Brand ID (must be active if provided) |
| `stock` | Number | No | Stock quantity (must be >= 0) |

#### File Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mainImage` | File | No | New primary image. If provided, old main image is replaced with new resized versions. |
| `media` | File[] | No | Additional media files to append (images/videos). Use field name `media` for all. |

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "productId": "6940f8abd572703fbcec42dc"
  }
}
```

### Error Responses

Same error format as **Create Product**, plus:

| Status Code | Description | Example Message |
|------------|-------------|-----------------|
| 404 | Not Found | "Product not found" |
| 403 | Forbidden | "You are not allowed to update this product" |

---

## DELETE PRODUCT

### Endpoint

`POST /api/vendor/products/:productId/delete`

### Type

`application/json`

### Behavior

- Performs a **soft delete**: sets `isActive` to `false`
- Product remains in DB but is hidden from normal listing

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

### Error Responses

| Status Code | Description | Example Message |
|------------|-------------|-----------------|
| 404 | Not Found | "Product not found" |
| 403 | Forbidden | "You are not allowed to delete this product" |

---

## GET ALL PRODUCTS (Vendor’s Own Products)

### Endpoint

`GET /api/vendor/products`

### Description

Returns a paginated list of products that belong to the **authenticated vendor**.

### Query Parameters (optional)

| Param | Type | Description |
|-------|------|-------------|
| `page` | Number | Page number (default: 1) |
| `limit` | Number | Page size (default: 10, max: 100) |
| `categoryId` | String | Filter by category |
| `subCategoryId` | String | Filter by sub-category |
| `brandId` | String | Filter by brand |
| `isActive` | Boolean | Filter by active status (default: true) |

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": {
    "items": [
      {
        "id": "6940f8abd572703fbcec42dc",
        "name": "iPhone 15 Pro",
        "slug": "iphone-15-pro",
        "description": "Latest iPhone with advanced features",
        "price": 999.99,
        "discountPrice": 899.99,
        "categoryId": "693fbef1493989b8b80a31a6",
        "subCategoryId": "693fbef1493989b8b80a31a8",
        "brandId": "693fbef1493989b8b80a31a7",
        "stock": 50,
        "mainImage": {
          "original": "https://s3.amazonaws.com/bucket/products/main.jpg",
          "size100": "https://s3.amazonaws.com/bucket/products/main-100px.jpg",
          "size200": "https://s3.amazonaws.com/bucket/products/main-200px.jpg"
        },
        "isActive": true,
        "createdAt": "2024-01-15T10:40:00.000Z",
        "updatedAt": "2024-01-15T10:40:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

## GET PRODUCT BY ID

### Endpoint

`GET /api/vendor/products/:productId`

### Description

Returns full details of a single product. Vendor can only see **their own** product.

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Product details fetched successfully",
  "data": {
    "id": "6940f8abd572703fbcec42dc",
    "name": "iPhone 15 Pro",
    "slug": "iphone-15-pro",
    "description": "Latest iPhone with advanced features",
    "price": 999.99,
    "discountPrice": 899.99,
    "categoryId": "693fbef1493989b8b80a31a6",
    "subCategoryId": "693fbef1493989b8b80a31a8",
    "brandId": "693fbef1493989b8b80a31a7",
    "stock": 50,
    "mainImage": {
      "original": "https://s3.amazonaws.com/bucket/products/main.jpg",
      "size100": "https://s3.amazonaws.com/bucket/products/main-100px.jpg",
      "size200": "https://s3.amazonaws.com/bucket/products/main-200px.jpg"
    },
    "media": [
      {
        "index": 0,
        "type": "image",
        "url": "https://s3.amazonaws.com/bucket/products/media/image1.jpg"
      }
    ],
    "isActive": true,
    "createdAt": "2024-01-15T10:40:00.000Z",
    "updatedAt": "2024-01-15T10:40:00.000Z"
  }
}
```

### Error Responses (for GET endpoints)

| Status Code | Description | Example Message |
|------------|-------------|-----------------|
| 404 | Not Found | "Product not found" |
| 403 | Forbidden | "You are not allowed to view this product" |

---

## Database Schema

### Product Model

```javascript
{
  name: String (required),
  slug: String (auto-generated from name),
  description: String (optional),
  price: Number (required, min: 0),
  discountPrice: Number (optional, min: 0),
  vendorId: ObjectId (required, ref: 'Vendor'),
  categoryId: ObjectId (required, ref: 'Category'),
  subCategoryId: String (optional) - Sub-category ID (embedded in Category),
  brandId: ObjectId (optional, ref: 'Brand'),
  stock: Number (required, min: 0),
    mainImage: {
      original: String (required) - Original size image URL,
      size100: String (required) - 100px width image URL,
      size200: String (required) - 200px width image URL
    },
  media: [
    {
      index: Number (required),
      type: String (enum: ['image', 'video'], required),
      url: String (required)
    }
  ],
  isActive: Boolean (default: true),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

---

## Security & Best Practices

### Security Measures

1. **Vendor ID Protection**
   - `vendorId` is extracted from JWT token only
   - Any `vendorId` in request body is ignored/removed
   - Prevents vendors from creating products for other vendors

2. **File Validation**
   - File type validation (images and videos only)
   - File size limits (50MB per file)
   - Maximum file count (20 media files)

3. **Data Validation**
   - All numeric fields validated (price, discountPrice, stock)
   - Negative values rejected
   - Discount price must be less than regular price
   - Category and Brand must exist and be active

4. **Soft Delete**
   - Products use `isActive` flag for soft deletion
   - Deleted products remain in database but are hidden

### Best Practices

1. **Error Handling**
   - Graceful handling of S3 upload failures
   - Clear, user-friendly error messages
   - No sensitive information leaked in errors

2. **Performance**
   - Media files uploaded in parallel for better performance
   - Indexes on frequently queried fields (vendorId, categoryId, brandId, isActive)

3. **Data Integrity**
   - Slug auto-generation from product name
   - Unique slugs for products
   - Referential integrity with Category and Brand models

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Product slugs are automatically generated and URL-friendly
- **Main Image Resizing:** The main image is automatically resized to three sizes:
  - **Original:** Full-size image (as uploaded)
  - **100px:** Resized to 100px width (maintains aspect ratio)
  - **200px:** Resized to 200px width (maintains aspect ratio)
  - All three sizes are uploaded to S3 and stored in the database
- Media files are indexed to preserve upload order
- S3 URLs are stored in the database after successful upload
- The `createdAt` and `updatedAt` fields are automatically managed by Mongoose
- Products are created with `isActive: true` by default

---

## Future Enhancements

- Product search and filter API (advanced filters, sorting)
- Product image/video management API (reorder / remove media)
- Bulk product upload API

