# Customer API Documentation

Base path: `/api/customer`

## Register
- `POST /register`
- Body:
```
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "password": "Password@123",
  "role": "customer",
  "address": {
    "street": "12 MG Road",
    "city": "Kolkata",
    "state": "West Bengal",
    "pincode": "700001",
    "country": "India"
  }
}
```
- Success: `201 Created` with `token` (customer id) and `customer` summary.
- Notes: Passwords are stored as plain text in the current project setup.

## Login
- `POST /login`
- Body: `{ "email": "rahul@example.com", "password": "Password@123" }`
- Success: `200 OK` and a new JWT `token` is generated and returned with `customer` summary.

## Logout
- `POST /logout`
- Success: `200 OK` message confirming logout.

## Forgot Password
- `POST /api/auth/forgot-password`
- Body: `{ "email": "rahul@example.com" }`
- Success: `200 OK` with reset `token` and `expiresAt` (returned here for demo; normally emailed).

## Reset Password
- `POST /api/auth/reset-password`
- Body: `{ "token": "<resetToken>", "newPassword": "NewPass@123" }`
- Success: `200 OK` and password updated.

---

# Customer Product Browse API

## Overview

This document describes the public Product Browse API for customers. This API allows customers to search, filter, and browse products without authentication.

**Base URL:** `/api/products`

**Authentication:** Not required (Public API)

---

## GET ALL PRODUCTS

### Endpoint

`GET /api/products`

### Authentication

- **Required:** No (Public API)
- Anyone can access this endpoint without authentication

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | String | No | Product name search (case-insensitive) | `"laptop"` |
| `category` | String | No | Category slug (filters by category) | `"electronics"` |
| `subCategory` | String | No | Sub-category slug (filters by sub-category) | `"smartphones"` |
| `brand` | String | No | Brand slug (filters by brand) | `"apple"` |
| `price` | String | No | Price range in format `"min-max"` | `"100-500"` |
| `sort` | String | No | Sort order: `price_asc`, `price_desc`, `newest` (default: `newest`) | `"price_asc"` |
| `page` | Number | No | Page number (default: 1, min: 1) | `1` |
| `limit` | Number | No | Items per page (default: 10, min: 1, max: 100) | `20` |

### Query Parameter Details

#### Search (`q`)
- Case-insensitive regex search on product name
- Example: `?q=laptop` will match "Laptop", "LAPTOP", "Gaming Laptop", etc.

#### Category Filter (`category`)
- Filters products by category slug
- Category must be active
- Example: `?category=electronics`

#### Sub-Category Filter (`subCategory`)
- Filters products by sub-category slug
- Supports nested sub-categories (recursive search)
- Sub-category must be active
- Example: `?subCategory=smartphones`
- **Note:** If `category` is also provided, sub-category must belong to that category

#### Brand Filter (`brand`)
- Filters products by brand slug
- Brand must be active
- Example: `?brand=apple`

#### Price Range (`price`)
- Format: `"min-max"` (e.g., `"100-500"`)
- Both min and max must be non-negative numbers
- Min must be less than or equal to max
- Example: `?price=100-500` (products between $100 and $500)

#### Sorting (`sort`)
- `price_asc`: Sort by price (lowest first)
- `price_desc`: Sort by price (highest first)
- `newest`: Sort by creation date (newest first) - **Default**

#### Pagination
- `page`: Page number (starts from 1)
- `limit`: Number of items per page (max 100)
- Default: `page=1`, `limit=10`

### Request Examples

#### Basic Request (Get all products)
```bash
curl -X GET "http://localhost:3000/api/products"
```

#### Search by Product Name
```bash
curl -X GET "http://localhost:3000/api/products?q=laptop"
```

#### Filter by Category
```bash
curl -X GET "http://localhost:3000/api/products?category=electronics"
```

#### Filter by Category and Sub-Category
```bash
curl -X GET "http://localhost:3000/api/products?category=electronics&subCategory=smartphones"
```

#### Filter by Brand
```bash
curl -X GET "http://localhost:3000/api/products?brand=apple"
```

#### Price Range Filter
```bash
curl -X GET "http://localhost:3000/api/products?price=100-500"
```

#### Sort by Price (Low to High)
```bash
curl -X GET "http://localhost:3000/api/products?sort=price_asc"
```

#### Sort by Price (High to Low)
```bash
curl -X GET "http://localhost:3000/api/products?sort=price_desc"
```

#### Combined Filters with Pagination
```bash
curl -X GET "http://localhost:3000/api/products?q=laptop&category=electronics&price=500-2000&sort=price_asc&page=1&limit=20"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "total": 150,
  "page": 1,
  "limit": 10,
  "products": [
    {
      "id": "694129c27f75e93fd924715d",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "price": 999.99,
      "discountPrice": 899.99,
      "category": {
        "id": "693fbef1493989b8b80a31a6",
        "name": "Electronics",
        "slug": "electronics"
      },
      "subCategoryId": "6941091b45d49162a03d72fb",
      "brand": {
        "id": "693fbef1493989b8b80a31a7",
        "name": "Apple",
        "slug": "apple"
      },
      "mainImage": {
        "original": "https://s3.amazonaws.com/bucket/products/main-image-original.jpg",
        "size100": "https://s3.amazonaws.com/bucket/products/main-image-100px.jpg",
        "size200": "https://s3.amazonaws.com/bucket/products/main-image-200px.jpg"
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `total` | Number | Total number of products matching the filters |
| `page` | Number | Current page number |
| `limit` | Number | Number of items per page |
| `products` | Array | Array of product objects |

#### Product Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Product ID (MongoDB ObjectId) |
| `name` | String | Product name |
| `slug` | String | URL-friendly product slug |
| `price` | Number | Product price |
| `discountPrice` | Number | Discounted price (if available) |
| `category` | Object | Category information (null if not available) |
| `category.id` | String | Category ID |
| `category.name` | String | Category name |
| `category.slug` | String | Category slug |
| `subCategoryId` | String | Sub-category ID (if assigned) |
| `brand` | Object | Brand information (null if not available) |
| `brand.id` | String | Brand ID |
| `brand.name` | String | Brand name |
| `brand.slug` | String | Brand slug |
| `mainImage` | Object | Main product image with 3 sizes |
| `mainImage.original` | String | Original image URL |
| `mainImage.size100` | String | 100px width image URL |
| `mainImage.size200` | String | 200px width image URL |
| `createdAt` | String | Product creation date (ISO 8601) |

### Error Responses

#### Category Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Category not found"
}
```

#### Sub-Category Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Sub-category not found"
}
```

**OR** (if category filter is also applied)

```json
{
  "success": false,
  "message": "Sub-category not found in the specified category"
}
```

#### Brand Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Brand not found"
}
```

#### Invalid Price Range Format
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid price range format. Use \"min-max\" (e.g., \"100-500\")"
}
```

#### Invalid Price Range Values
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid price range. Min must be less than or equal to max, and both must be non-negative"
}
```

#### Internal Server Error
**Status Code:** `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Internal Server Error"
}
```

### Notes

1. **Active Products Only:** Only products with `isActive: true` are returned
2. **Active Categories/Brands:** Only active categories, sub-categories, and brands are considered for filtering
3. **Sub-Category Search:** The API performs a recursive search through nested sub-categories to find matches by slug
4. **Performance:** The API uses MongoDB indexes for optimal query performance
5. **Pagination:** Maximum limit is 100 items per page to prevent performance issues
6. **Case-Insensitive Search:** Product name search (`q`) is case-insensitive
7. **Empty Results:** If no products match the filters, an empty array is returned with `total: 0`

### Example Use Cases

#### 1. Browse All Products (First Page)
```bash
GET /api/products
```

#### 2. Search for Laptops
```bash
GET /api/products?q=laptop
```

#### 3. Browse Electronics Category
```bash
GET /api/products?category=electronics
```

#### 4. Find Smartphones Under $500
```bash
GET /api/products?category=electronics&subCategory=smartphones&price=0-500&sort=price_asc
```

#### 5. Browse Apple Products (Sorted by Newest)
```bash
GET /api/products?brand=apple&sort=newest
```

#### 6. Advanced Search with All Filters
```bash
GET /api/products?q=gaming&category=electronics&subCategory=laptops&brand=asus&price=1000-3000&sort=price_desc&page=1&limit=20
```

---

## Performance & Best Practices

### Database Indexes

The following indexes are optimized for this API:
- `name` - For product name search
- `price` - For price sorting
- `createdAt` - For newest sorting
- `isActive` - For filtering active products
- `categoryId` - For category filtering
- `subCategoryId` - For sub-category filtering
- `brandId` - For brand filtering
- Compound indexes for common query patterns

### Query Optimization

- Uses `lean()` for read-only queries (faster, no Mongoose overhead)
- Limits populated fields to only required data
- Efficient pagination with `skip()` and `limit()`
- Parallel execution of count and data queries using `Promise.all()`

### Recommendations

1. **Pagination:** Always use pagination for large result sets
2. **Limit Size:** Keep `limit` reasonable (recommended: 10-50 items per page)
3. **Caching:** Consider implementing caching for frequently accessed queries
4. **Rate Limiting:** Implement rate limiting for production use

---

# Customer Profile Picture API

## Overview

This document describes the Customer Profile Picture API. This API allows authenticated customers to upload, view, and delete their profile pictures.

**Base URL:** `/api/customer`

**Authentication:** All profile picture endpoints require JWT authentication with customer role.

---

## UPLOAD PROFILE PICTURE

### Endpoint

`POST /api/customer/profile/picture`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can upload their own profile picture
- Customer ID is extracted from JWT token
- Profile picture replaces any existing picture

### Request Headers

```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

### Request Body (Form Data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profilePicture` | File | Yes | Image file (JPG, PNG, WebP) - Max 5MB |

### Request Example

#### Using cURL

```bash
curl -X POST http://localhost:3000/api/customer/profile/picture \
  -H "Authorization: Bearer <your-jwt-token>" \
  -F "profilePicture=@/path/to/image.jpg"
```

#### Using JavaScript (FormData)

```javascript
const formData = new FormData();
formData.append('profilePicture', fileInput.files[0]);

fetch('http://localhost:3000/api/customer/profile/picture', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Controller Logic (Step by Step)

1. **Authenticate customer** using JWT token (via middleware)
2. **Validate file** is provided in request
3. **Find customer** by ID from token
4. **Upload original image** to S3 (customers/profile-pictures folder)
5. **Resize and upload 100px version** to S3
6. **Resize and upload 200px version** to S3
7. **Update customer** profilePicture field with all three URLs
8. **Save customer** document
9. **Return success response** with profile picture URLs

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Profile picture uploaded successfully",
  "data": {
    "profilePicture": {
      "original": "https://bucket.s3.amazonaws.com/customers/profile-pictures/uuid-original.jpg",
      "size100": "https://bucket.s3.amazonaws.com/customers/profile-pictures/uuid_100px.jpg",
      "size200": "https://bucket.s3.amazonaws.com/customers/profile-pictures/uuid_200px.jpg"
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Success message |
| `data` | Object | Response data |
| `data.profilePicture` | Object | Profile picture URLs |
| `data.profilePicture.original` | String | Original size image URL |
| `data.profilePicture.size100` | String | 100px width image URL |
| `data.profilePicture.size200` | String | 200px width image URL |

### Error Responses

#### Missing File

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Profile picture file is required. Please send it as form-data field \"profilePicture\" with a valid image file (JPG, PNG, WebP)."
}
```

#### Invalid File Type

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid file type. Only JPG, PNG, and WebP images are allowed."
}
```

#### File Too Large

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "File size too large. Maximum size is 5MB."
}
```

#### Missing Authorization

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

#### Customer Not Found

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Customer not found"
}
```

#### S3 Upload Error

**Status Code:** `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Failed to upload profile picture to S3"
}
```

---

## GET PROFILE

### Endpoint

`GET /api/customer/profile`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can view their own profile
- Customer ID is extracted from JWT token

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### Request Example

```bash
curl -X GET http://localhost:3000/api/customer/profile \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "694129c27f75e93fd924715d",
      "name": "Rahul Sharma",
      "email": "rahul@example.com",
      "phone": "9876543210",
      "role": "customer",
      "address": {
        "street": "12 MG Road",
        "city": "Kolkata",
        "state": "West Bengal",
        "pincode": "700001",
        "country": "India"
      },
      "profilePicture": {
        "original": "https://bucket.s3.amazonaws.com/customers/profile-pictures/uuid-original.jpg",
        "size100": "https://bucket.s3.amazonaws.com/customers/profile-pictures/uuid_100px.jpg",
        "size200": "https://bucket.s3.amazonaws.com/customers/profile-pictures/uuid_200px.jpg"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T12:45:00.000Z"
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `data` | Object | Response data |
| `data.customer` | Object | Customer profile information |
| `data.customer.id` | String | Customer ID |
| `data.customer.name` | String | Customer name |
| `data.customer.email` | String | Customer email |
| `data.customer.phone` | String | Customer phone |
| `data.customer.role` | String | Customer role |
| `data.customer.address` | Object | Customer address |
| `data.customer.profilePicture` | Object | Profile picture URLs (null if not set) |
| `data.customer.createdAt` | String | Account creation date (ISO 8601) |
| `data.customer.updatedAt` | String | Last update date (ISO 8601) |

---

## DELETE PROFILE PICTURE

### Endpoint

`DELETE /api/customer/profile/picture`

### Authentication

- **Required:** Yes (JWT Token)
- **Role:** Customer
- **Token Location:** `Authorization: Bearer <jwt-token>`

### Access Rules

- Only authenticated customers can delete their own profile picture
- Customer ID is extracted from JWT token

### Request Headers

```
Authorization: Bearer <jwt-token>
```

### Request Example

```bash
curl -X DELETE http://localhost:3000/api/customer/profile/picture \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Profile picture deleted successfully"
}
```

### Error Responses

#### Missing Authorization

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

#### Customer Not Found

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Customer not found"
}
```

---

## Database Schema

### Customer Model (Updated)

```javascript
{
  name: String,
  email: String,
  phone: String,
  password: String,
  role: String,
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  profilePicture: {
    original: String,      // Original size image URL
    size100: String,       // 100px width image URL
    size200: String        // 200px width image URL
  },
  resetToken: String,
  resetTokenExpiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Image Processing

### Image Sizes

1. **Original:** Full-size image as uploaded
2. **Size 100:** Resized to 100px width (maintains aspect ratio)
3. **Size 200:** Resized to 200px width (maintains aspect ratio)

### Image Storage

- **Location:** S3 bucket under `customers/profile-pictures/` folder
- **Naming:** UUID-based filenames to prevent conflicts
- **Format:** Original format preserved (JPG, PNG, WebP)

### Image Resizing

- Uses Sharp library for high-quality image resizing
- Maintains aspect ratio
- Does not enlarge images smaller than target size
- Optimized for web performance

---

## File Upload Specifications

### Allowed File Types

- JPEG/JPG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- WebP (`.webp`)

### File Size Limit

- **Maximum:** 5MB per file
- **Recommended:** Under 2MB for faster uploads

### Form Data Field Name

- **Field Name:** `profilePicture`
- **Type:** File upload
- **Required:** Yes (for upload endpoint)

---

## Notes

1. **Image Optimization:** Images are automatically resized to multiple sizes for optimal performance
2. **S3 Storage:** All images are stored in AWS S3 for scalability and reliability
3. **Replacement:** Uploading a new profile picture replaces the existing one
4. **Deletion:** Deleting profile picture removes all three image sizes from database (S3 files remain)
5. **Security:** Only authenticated customers can upload/delete their own profile pictures
6. **Validation:** File type and size validation performed before upload

---

## Example Use Cases

### Use Case 1: Upload Profile Picture

**Scenario:** Customer wants to set their profile picture

**Request:**
```bash
POST /api/customer/profile/picture
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: profilePicture=<image-file>
```

**Response:** Returns profile picture URLs in three sizes

### Use Case 2: View Profile

**Scenario:** Customer wants to view their complete profile including profile picture

**Request:**
```bash
GET /api/customer/profile
Authorization: Bearer <token>
```

**Response:** Returns complete customer profile with profile picture URLs

### Use Case 3: Delete Profile Picture

**Scenario:** Customer wants to remove their profile picture

**Request:**
```bash
DELETE /api/customer/profile/picture
Authorization: Bearer <token>
```

**Response:** Confirms deletion

---

## Future Enhancements

1. **Image Cropping:** Add client-side image cropping before upload
2. **S3 Cleanup:** Implement automatic deletion of old images from S3 when replaced
3. **Image Compression:** Add additional compression for smaller file sizes
4. **Multiple Formats:** Support additional image formats (GIF, etc.)
5. **Profile Picture History:** Keep history of previous profile pictures
6. **Avatar Generation:** Generate default avatars if no picture is uploaded

