# Category & Brand API Documentation

## Overview

This document describes the Category and Brand management APIs. Categories and Brands are core entities for organizing products in the e-commerce platform.

**Base URLs:**
- Public APIs: `/api/categories`, `/api/brands`
- Admin APIs: All CRUD operations are under `/api/categories` and `/api/brands` with authentication required

**Authentication:**
- Public endpoints (GET) do not require authentication
- Admin endpoints require JWT token in `Authorization: Bearer <token>` header
- Only users with `admin` or `super-admin` roles can access admin endpoints

**Response Format:**
All responses follow a standardized format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Clear error message"
}
```

---

## CATEGORY APIs

### 1. Create Category

**Endpoint:** `POST /api/categories/create`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Electronics",
  "description": "Electronic products and gadgets"
}
```

**Note:** This creates a top-level category. Sub-categories are stored as an embedded array within the parent category document. Use the sub-category endpoint to add sub-categories.

**Request Body Fields:**
- `name` (String, required): Category name (must be unique)
- `description` (String, optional): Category description

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "id": "693fbef1493989b8b80a31a6",
        "name": "Electronics",
        "slug": "electronics",
        "description": "Electronic products and gadgets",
        "isActive": true,
        "subCategories": [],
        "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing or invalid name
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `409 Conflict`: Category with this name already exists

**Example:**
```bash
curl -X POST http://localhost:3000/api/categories/create \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electronics",
    "description": "Electronic products and gadgets"
  }'
```

---

### 2. Update Category

**Endpoint:** `POST /api/categories/:id/update`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (String, required): Category ID

**Request Body:**
```json
{
  "name": "Electronics & Gadgets",
  "description": "Updated description",
  "isActive": true
}
```

**Request Body Fields (all optional):**
- `name` (String): New category name
- `description` (String): New description
- `isActive` (Boolean): Active status

**Note:** Sub-categories are managed through the sub-category endpoints. This endpoint only updates top-level category fields.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "id": "693fbef1493989b8b80a31a6",
        "name": "Electronics & Gadgets",
        "slug": "electronics-gadgets",
        "description": "Updated description",
        "isActive": true,
        "subCategories": [],
        "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Category not found
- `409 Conflict`: Category with this name already exists

**Example:**
```bash
curl -X POST http://localhost:3000/api/categories/693fbef1493989b8b80a31a6/update \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electronics & Gadgets",
    "description": "Updated description"
  }'
```

---

### 3. Delete Category (Soft Delete)

**Endpoint:** `POST /api/categories/:id/delete`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `id` (String, required): Category ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Category deleted successfully (soft delete)",
  "data": {
    "id": "693fbef1493989b8b80a31a6",
    "name": "Electronics",
    "isActive": false
  }
}
```

**Note:** This is a soft delete operation. The category's `isActive` field is set to `false`, but the record remains in the database. It will not appear in public API responses.

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Category not found

**Example:**
```bash
curl -X POST http://localhost:3000/api/categories/693fbef1493989b8b80a31a6/delete \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

### 4. Get All Categories (Public)

**Endpoint:** `GET /api/categories`

**Authentication:** Not required (Public endpoint)

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": {
    "categories": [
      {
        "id": "693fbef1493989b8b80a31a6",
        "name": "Electronics",
        "slug": "electronics",
        "description": "Electronic products and gadgets",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "subCategories": [
          {
            "id": "693fbef1493989b8b80a31a8",
            "name": "Smartphones",
            "slug": "smartphones",
            "description": "Mobile phones and smartphones",
            "isActive": true,
            "createdAt": "2024-01-15T10:40:00.000Z",
            "updatedAt": "2024-01-15T10:40:00.000Z",
            "subCategories": [
              {
                "id": "693fbef1493989b8b80a31a9",
                "name": "Android Phones",
                "slug": "android-phones",
                "description": "Android smartphones",
                "isActive": true,
                "createdAt": "2024-01-15T10:45:00.000Z",
                "updatedAt": "2024-01-15T10:45:00.000Z"
              }
            ]
          }
        ]
      },
      {
        "id": "693fbef1493989b8b80a31a7",
        "name": "Clothing",
        "slug": "clothing",
        "description": "Apparel and fashion items",
        "createdAt": "2024-01-15T10:35:00.000Z",
        "subCategories": []
      }
    ],
    "count": 2
  }
}
```

**Note:** 
- Only active categories (`isActive: true`) are returned in this public endpoint.
- Categories are returned with their embedded `subCategories` arrays.
- Sub-categories are stored as embedded documents within the parent category document.
- Sub-categories can have their own nested sub-categories, creating multi-level hierarchies.

**Example:**
```bash
curl -X GET http://localhost:3000/api/categories
```

---

### 5. Get Category by ID (Public)

**Endpoint:** `GET /api/categories/:id`

**Authentication:** Not required (Public endpoint)

**URL Parameters:**
- `id` (String, required): Category ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "id": "693fbef1493989b8b80a31a6",
        "name": "Electronics",
        "slug": "electronics",
        "description": "Electronic products and gadgets",
        "isActive": true,
        "subCategories": [],
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Note:** Only active categories (`isActive: true`) are returned. Inactive or deleted categories will return a 404 error.

**Error Responses:**
- `400 Bad Request`: Invalid category ID format
- `404 Not Found`: Category not found or inactive

**Example:**
```bash
curl -X GET http://localhost:3000/api/categories/693fbef1493989b8b80a31a6
```

---

### 6. Create Sub-Category

**Endpoint:** `POST /api/categories/:parentId/subcategories`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `parentId` (String, required): Parent category ID

**Request Body:**
```json
{
  "name": "Smartphones",
  "description": "Mobile phones and smartphones",
  "parentSubCategoryId": null
}
```

**Request Body Fields:**
- `name` (String, required): Sub-category name (must be unique under the same parent)
- `description` (String, optional): Sub-category description
- `parentSubCategoryId` (String, optional): If creating a nested sub-category (sub-category of a sub-category), provide the parent sub-category ID. If not provided or `null`, creates a top-level sub-category under the parent category.

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Sub-category created successfully",
  "data": {
    "id": "693fbef1493989b8b80a31a8",
    "name": "Smartphones",
    "slug": "smartphones",
    "description": "Mobile phones and smartphones",
    "isActive": true
  }
}
```

**Note:** Sub-categories are stored as embedded documents within the parent category's `subCategories` array. Each sub-category has its own `_id` and can have nested sub-categories.

**Error Responses:**
- `400 Bad Request`: Missing or invalid name, invalid parent category ID format, or parent category is inactive
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Parent category not found
- `409 Conflict`: Sub-category with this name already exists under this parent

**Example:**
```bash
curl -X POST http://localhost:3000/api/categories/693fbef1493989b8b80a31a6/subcategories \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smartphones",
    "description": "Mobile phones and smartphones"
  }'
```

**Example - Create Top-Level Sub-Category:**
```bash
curl -X POST http://localhost:3000/api/categories/693fbef1493989b8b80a31a6/subcategories \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smartphones",
    "description": "Mobile phones and smartphones"
  }'
```

**Note:** 
- Sub-categories are stored as embedded documents within the parent category's `subCategories` array
- Sub-categories can have their own sub-categories, creating a multi-level hierarchy
- To create nested sub-categories (sub-category of a sub-category), you can either:
  - Use this endpoint with `parentSubCategoryId` in the request body, OR
  - Use the dedicated nested sub-category endpoint (see section 7 below)
- If `parentSubCategoryId` is not provided or is `null`, creates a top-level sub-category directly under the parent category
- The sub-category is automatically added to the appropriate parent's `subCategories` array

---

### 7. Create Nested Sub-Category (Sub-Category under Sub-Category)

**Endpoint:** `POST /api/categories/:parentId/subcategories/:subCategoryId/subcategories`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `parentId` (String, required): Parent category ID
- `subCategoryId` (String, required): Parent sub-category ID (the sub-category under which to create a new sub-category)

**Request Body:**
```json
{
  "name": "Gaming Phones",
  "description": "Gaming smartphones"
}
```

**Request Body Fields:**
- `name` (String, required): Sub-category name (must be unique under the same parent sub-category)
- `description` (String, optional): Sub-category description

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Nested sub-category created successfully",
  "data": {
    "id": "69411f0a712729f5ce20c78d",
    "name": "Gaming Phones",
    "slug": "gaming-phones",
    "description": "Gaming smartphones",
    "isActive": true
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing or invalid name, invalid category/sub-category ID format, or parent/sub-category is inactive
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Parent category not found or parent sub-category not found
- `409 Conflict`: Sub-category with this name already exists under this parent sub-category

**Example:**
```bash
curl -X POST http://localhost:3000/api/categories/694058c357fa30dd144acea3/subcategories/69411f0a712729f5ce20c78d/subcategories \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gaming Phones",
    "description": "Gaming smartphones"
  }'
```

**Note:** 
- This endpoint creates a sub-category directly under an existing sub-category
- The sub-category is added to the parent sub-category's `subCategories` array
- This allows for unlimited nesting levels (sub-category → sub-category → sub-category...)
- Each nested sub-category will have its own unique `id` that can be used for further nesting

---

### 8. Get Sub-Categories

**Endpoint:** `GET /api/categories/:parentId/subcategories`

**Authentication:** Not required (Public endpoint)

**URL Parameters:**
- `parentId` (String, required): Parent category ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Sub-categories retrieved successfully",
  "data": {
    "parentCategory": {
      "id": "693fbef1493989b8b80a31a6",
      "name": "Electronics",
      "slug": "electronics"
    },
        "subCategories": [
          {
            "id": "693fbef1493989b8b80a31a8",
            "name": "Smartphones",
            "slug": "smartphones",
            "description": "Mobile phones and smartphones",
            "isActive": true,
            "createdAt": "2024-01-15T10:40:00.000Z",
            "updatedAt": "2024-01-15T10:40:00.000Z",
            "subCategories": [
              {
                "id": "693fbef1493989b8b80a31a9",
                "name": "Android Phones",
                "slug": "android-phones",
                "description": "Android smartphones",
                "isActive": true,
                "createdAt": "2024-01-15T10:45:00.000Z",
                "updatedAt": "2024-01-15T10:45:00.000Z"
              }
            ]
          },
          {
            "id": "693fbef1493989b8b80a31aa",
            "name": "Laptops",
            "slug": "laptops",
            "description": "Laptop computers",
            "isActive": true,
            "createdAt": "2024-01-15T10:50:00.000Z",
            "updatedAt": "2024-01-15T10:50:00.000Z"
          }
        ],
        "count": 2,
        "totalCount": 3
  }
}
```

**Note:** 
- Sub-categories are returned from the parent category's embedded `subCategories` array
- The response includes nested sub-categories recursively, allowing for multi-level category hierarchies
- Only active sub-categories are returned
- `count` shows the number of direct sub-categories, `totalCount` includes all nested sub-categories

**Error Responses:**
- `400 Bad Request`: Invalid parent category ID format
- `404 Not Found`: Parent category not found

**Example:**
```bash
curl -X GET http://localhost:3000/api/categories/693fbef1493989b8b80a31a6/subcategories
```

---

### 9. Update Sub-Category

**Endpoint:** `POST /api/categories/:parentId/subcategories/:subCategoryId/update`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `parentId` (String, required): Parent category ID
- `subCategoryId` (String, required): Sub-category ID to update

**Request Body:**
```json
{
  "name": "Updated Sub-Category Name",
  "description": "Updated description",
  "isActive": true
}
```

**Request Body Fields:**
- `name` (String, optional): Sub-category name (must be unique under the same parent if changed)
- `description` (String, optional): Sub-category description
- `isActive` (Boolean, optional): Sub-category active status

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Sub-category updated successfully",
  "data": {
    "id": "693fbef1493989b8b80a31a8",
    "name": "Updated Sub-Category Name",
    "slug": "updated-sub-category-name",
    "description": "Updated description",
    "isActive": true
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid name format, invalid isActive value, or invalid ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Parent category not found or sub-category not found
- `409 Conflict`: Sub-category with this name already exists under the same parent

**Example:**
```bash
curl -X POST http://localhost:3000/api/categories/693fbef1493989b8b80a31a6/subcategories/693fbef1493989b8b80a31a8/update \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Sub-Category Name",
    "description": "Updated description",
    "isActive": true
  }'
```

**Note:** 
- All fields in the request body are optional
- Only provided fields will be updated
- If `name` is updated, the `slug` is automatically regenerated
- The sub-category can be at any nesting level (top-level or nested)

---

### 10. Delete Sub-Category

**Endpoint:** `POST /api/categories/:parentId/subcategories/:subCategoryId/delete`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `parentId` (String, required): Parent category ID
- `subCategoryId` (String, required): Sub-category ID to delete

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Sub-category deleted successfully",
  "data": {
    "id": "693fbef1493989b8b80a31a8",
    "name": "Sub-Category Name"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid category or sub-category ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Parent category not found or sub-category not found

**Example:**
```bash
curl -X POST http://localhost:3000/api/categories/693fbef1493989b8b80a31a6/subcategories/693fbef1493989b8b80a31a8/delete \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

**Note:** 
- This is a hard delete operation (the sub-category is completely removed from the parent category's `subCategories` tree)
- Once deleted, the sub-category cannot be recovered from this API
- The sub-category can be at any nesting level (top-level or nested)
- Deleting a sub-category will also remove its nested sub-categories, because they are embedded within it

---

## BRAND APIs

### 1. Create Brand

**Endpoint:** `POST /api/brands/create`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Request Body:**
Form-data with the following fields:

**Request Body Fields:**
- `brandName` (String, required): Brand name (must be unique)
- `categoryId` (String, required): Category ID (must be a valid active category)
- `brand_logo` (File, optional): Brand logo image file. Supported formats: JPG, PNG, GIF, WebP. The file will be uploaded to AWS S3 bucket and the S3 URL will be stored.

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Brand created successfully",
  "data": {
    "id": "693fbef1493989b8b80a31a7",
    "brandName": "Samsung",
    "slug": "samsung",
    "categoryId": "693fbef1493989b8b80a31a6",
    "brand_logo": "https://your-s3-bucket.s3.amazonaws.com/brands/samsung-logo-123456.png",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Note:** The `brand_logo` field contains the AWS S3 URL where the uploaded logo file is stored.

**Error Responses:**
- `400 Bad Request`: Missing or invalid brandName, missing categoryId, invalid category ID format, invalid file format, or file upload failed
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Category not found or category is inactive
- `409 Conflict`: Brand with this name already exists
- `500 Internal Server Error`: AWS S3 upload failed

**Example:**
```bash
curl -X POST http://localhost:3000/api/brands/create \
  -H "Authorization: Bearer <your-jwt-token>" \
  -F "brandName=Samsung" \
  -F "categoryId=693fbef1493989b8b80a31a6" \
  -F "brand_logo=@/path/to/samsung-logo.png"
```

**Note:** When using form-data, the `brand_logo` field should be sent as a file upload. The `@` symbol in curl indicates a file path. The file will be automatically uploaded to AWS S3 and the S3 URL will be returned in the response.

---

### 2. Update Brand

**Endpoint:** `POST /api/brands/:id/update`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (String, required): Brand ID

**Request Body:**
```json
{
  "brandName": "Samsung Electronics",
  "categoryId": "693fbef1493989b8b80a31a6",
  "isActive": true
}
```

**Request Body Fields (all optional):**
- `brandName` (String): New brand name
- `categoryId` (String): New category ID (must be a valid active category)
- `isActive` (Boolean): Active status

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Brand updated successfully",
  "data": {
    "id": "693fbef1493989b8b80a31a7",
    "brandName": "Samsung Electronics",
    "slug": "samsung-electronics",
    "categoryId": "693fbef1493989b8b80a31a6",
    "isActive": true,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data or invalid category ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Brand not found, category not found, or category is inactive
- `409 Conflict`: Brand with this name already exists

**Example:**
```bash
curl -X POST http://localhost:3000/api/brands/693fbef1493989b8b80a31a7/update \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "brandName": "Samsung Electronics",
    "categoryId": "693fbef1493989b8b80a31a6",
    "isActive": true
  }'
```

---

### 3. Delete Brand (Soft Delete)

**Endpoint:** `POST /api/brands/:id/delete`

**Authentication:** Required (Admin/Super Admin)

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `id` (String, required): Brand ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Brand deleted successfully (soft delete)",
  "data": {
    "id": "693fbef1493989b8b80a31a7",
    "brandName": "Samsung",
    "isActive": false
  }
}
```

**Note:** This is a soft delete operation. The brand's `isActive` field is set to `false`, but the record remains in the database. It will not appear in public API responses.

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Brand not found

**Example:**
```bash
curl -X POST http://localhost:3000/api/brands/693fbef1493989b8b80a31a7/delete \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

### 4. Get All Brands (Public)

**Endpoint:** `GET /api/brands`

**Authentication:** Not required (Public endpoint)

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Brands retrieved successfully",
  "data": {
    "brands": [
      {
        "brandName": "Samsung",
        "slug": "samsung",
        "categoryId": "693fbef1493989b8b80a31a6",
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "brandName": "Apple",
        "slug": "apple",
        "categoryId": "693fbef1493989b8b80a31a6",
        "createdAt": "2024-01-15T10:35:00.000Z"
      }
    ],
    "count": 2
  }
}
```

**Note:** Only active brands (`isActive: true`) are returned in this public endpoint.

**Example:**
```bash
curl -X GET http://localhost:3000/api/brands
```

---

## Features

### Auto Slug Generation
- Slugs are automatically generated from the name field
- Slugs are URL-friendly (lowercase, hyphens instead of spaces)
- Slugs are unique within the same parent category and indexed for fast lookups
- Slugs are automatically updated when the name changes

### Hierarchical Categories (Sub-Categories)
- Categories support multi-level hierarchies through embedded `subCategories` arrays
- Sub-categories are stored as embedded documents within the parent category document
- Sub-categories can have their own nested sub-categories, creating unlimited nesting levels
- Category names must be unique at the top level
- Sub-category names must be unique within the same parent category
- When retrieving categories, sub-categories are automatically included in the response
- Each sub-category has its own `_id`, `name`, `slug`, `description`, `isActive`, and `subCategories` fields

### Soft Delete
- Categories and Brands are never permanently deleted
- Deletion sets `isActive: false`
- Soft-deleted items do not appear in public API responses
- Records can be restored by updating `isActive: true`

### Validation
- Name fields are required and must be non-empty strings
- Duplicate names are prevented (both name and slug are checked)
- `isActive` must be a boolean value when provided

### Security
- JWT authentication required for admin endpoints
- Role-based authorization (admin/super-admin only)
- Public endpoints are accessible without authentication
- Standardized error messages (no sensitive information leaked)

---

## Error Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (resource doesn't exist) |
| 409 | Conflict (duplicate entry) |
| 500 | Internal Server Error |

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Category and Brand names are case-sensitive for uniqueness
- Slug generation handles special characters and converts them appropriately
- The `createdAt` and `updatedAt` fields are automatically managed by Mongoose
- Indexes are created on `slug` (via unique constraint) and `isActive` for optimal query performance

