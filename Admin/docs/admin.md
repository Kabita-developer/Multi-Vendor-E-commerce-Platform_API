# Admin API Documentation

Base path: `/api/admin`

## Signup
- `POST /signup`
- Body: `{ "email": "admin@example.com", "password": "secret", "name": "Required Name" }`
- Success: `201 Created` with `admin` summary (no token is issued on signup).

## Login
- `POST /login`
- Body: `{ "email": "admin@example.com", "password": "secret" }`
- Success: `200 OK` with new `token` and `admin` summary.

## Logout
- `POST /logout`
- Headers: `Authorization: Bearer <token>`
- Success: `200 OK` and the token is invalidated.

## Approve Vendor
- `POST /vendors/:id/approve`
- Body (optional): `{ "approverEmail": "admin@example.com" }`
- Success: `200 OK` with updated vendor marked as `approved` by admin.

## Reject Vendor
- `POST /vendors/:id/reject`
- Body (optional): `{ "approverEmail": "admin@example.com", "reason": "Optional reason" }`
- Success: `200 OK` with updated vendor marked as `rejected` by admin.

## Forgot Password
- `POST /api/auth/forgot-password`
- Body: `{ "email": "<admin email>" }`
- Success: `200 OK` with reset `token` and `expiresAt` (returned here for demo; normally emailed).

## Reset Password
- `POST /api/auth/reset-password`
- Body: `{ "token": "<resetToken>", "newPassword": "<newPass>" }`
- Success: `200 OK` and password updated.

## List Vendors
- `GET /vendors`
- Success: `200 OK` with array of all vendors.

## List Pending Vendors
- `GET /vendors/pending`
- Success: `200 OK` with array of vendors whose status is `pending`.

## Get Vendor By ID
- `GET /vendors/:id`
- Success: `200 OK` with vendor details when found; `404` if not found.

## Get All Vendor Products
- `GET /products`
- Headers: `Authorization: Bearer <token>`
- Query Parameters (all optional):
  - `page` (Number): Page number (default: 1)
  - `limit` (Number): Page size (default: 10, max: 100)
  - `vendorId` (String): Filter by vendor ID
  - `categoryId` (String): Filter by category ID
  - `subCategoryId` (String): Filter by sub-category ID
  - `brandId` (String): Filter by brand ID
  - `isActive` (Boolean): Filter by active status (default: true)
- Success: `200 OK` with paginated list of all vendor products including vendor information
- Response includes vendor details (shopName, ownerName, email) for each product

**Example:**
```bash
curl -X GET "http://localhost:3000/api/admin/products?page=1&limit=10&isActive=true" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor products fetched successfully",
  "data": {
    "items": [
      {
        "id": "6940f8abd572703fbcec42dc",
        "name": "iPhone 15 Pro",
        "slug": "iphone-15-pro",
        "description": "Latest iPhone with advanced features",
        "price": 999.99,
        "discountPrice": 899.99,
        "vendorId": "693fbef1493989b8b80a31a5",
        "vendor": {
          "id": "693fbef1493989b8b80a31a5",
          "shopName": "Tech Store",
          "ownerName": "John Doe",
          "email": "vendor@example.com"
        },
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

### Notes
- Tokens are random strings tracked per user in `activeTokens`.
- Passwords use salted PBKDF2 hashing (no plaintext passwords).
- Set `MONGODB_URI` to point at your MongoDB instance; default is `mongodb://127.0.0.1:27017/multi_vendor`.

