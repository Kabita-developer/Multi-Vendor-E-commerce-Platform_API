# Vendor API Documentation

Base path: `/api/vendor`

## Signup
- `POST /signup`
- Body:
```
{
  "shopName": "Star Rice Store",
  "ownerName": "Rahul Sharma",
  "email": "rahul@ricestore.com",
  "phone": "9876543210",
  "password": "Vendor@123",
  "address": {
    "state": "West Bengal",
    "city": "Kolkata",
    "pincode": "700001"
  },
  "bankDetails": {
    "accountHolder": "Rahul Sharma",
    "accountNumber": "1234567890",
    "ifsc": "SBIN0000123"
  }
}
```
- Success: `201 Created` with message `Signup successfully, now wait for admin approval` and `vendor` summary.
- Notes: Password is stored as plain text per current project setup; update to hashing if security requirements change.

## Login
- `POST /login`
- Body: `{ "email": "rahul@ricestore.com", "password": "Vendor@123" }`
- Success: `200 OK` with `token` (vendor id) and vendor summary.
- Vendor must be approved by an admin or super admin before login succeeds; otherwise `403` with current status.

## Logout
- `POST /logout`
- Success: `200 OK` message confirming logout.

## Forgot Password
- `POST /api/auth/forgot-password`
- Body: `{ "email": "<vendor email>" }`
- Success: `200 OK` with reset `token` and `expiresAt` (returned here for demo; normally emailed).

## Reset Password
- `POST /api/auth/reset-password`
- Body: `{ "token": "<resetToken>", "newPassword": "<newPass>" }`
- Success: `200 OK` and password updated.

