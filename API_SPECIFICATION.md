# API Specification - Bus Ticketing System

## Base URL
```
Production: https://api.busticketing.com/api/v1
Development: http://localhost:8000/api/v1
```

## Authentication
All endpoints (except `/auth/register`, `/auth/verify-otp`, `/auth/login`) require:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## AUTHENTICATION ENDPOINTS

### 1. Register New User
**POST** `/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe",
  "phoneNumber": "+94712345678",
  "userType": "rider" // rider, bus_owner, accountant
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "OTP sent to phone number",
  "userId": "uuid",
  "requiresOtpVerification": true
}
```

### 2. Verify OTP
**POST** `/auth/verify-otp`

**Request Body:**
```json
{
  "userId": "uuid",
  "otp": "123456",
  "phoneNumber": "+94712345678"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User account created successfully",
  "token": "jwt_token",
  "refreshToken": "refresh_token"
}
```

### 3. Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "jwt_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "rider"
  }
}
```

### 4. Refresh Token
**POST** `/auth/refresh-token`

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response (200):**
```json
{
  "token": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

### 5. Logout
**POST** `/auth/logout`

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## TICKET ENDPOINTS

### 1. Purchase Ticket
**POST** `/tickets/purchase`

**Request Body:**
```json
{
  "userId": "uuid",
  "routeId": "uuid",
  "fromStopId": "uuid",
  "toStopId": "uuid",
  "passengerCount": 1,
  "amount": 50.00,
  "paymentMethod": "card" // card, cash_on_boarding, wallet
}
```

**Response (201):**
```json
{
  "success": true,
  "ticket": {
    "id": "uuid",
    "ticketNumber": "TKT-2026-001234",
    "routeNumber": "101",
    "fromStop": "Central Station",
    "toStop": "Airport",
    "purchaseDate": "2026-02-10T10:30:00Z",
    "validFrom": "2026-02-10",
    "amount": 50.00,
    "qrCode": "base64_string",
    "status": "active"
  }
}
```

### 2. Get Ticket Details
**GET** `/tickets/{ticketId}`

**Response (200):**
```json
{
  "success": true,
  "ticket": {
    "id": "uuid",
    "ticketNumber": "TKT-2026-001234",
    "routeNumber": "101",
    "busNumber": "BUS-456",
    "fromStop": "Central Station",
    "toStop": "Airport",
    "purchaseDate": "2026-02-10T10:30:00Z",
    "validFrom": "2026-02-10",
    "expiryDate": "2026-02-17",
    "amount": 50.00,
    "qrCode": "base64_string",
    "status": "active",
    "passengerInfo": { "name": "John Doe", "id": "ID123" }
  }
}
```

### 3. Get User Transaction History
**GET** `/tickets/user/{userId}?limit=20&offset=0&status=all`

**Query Params:**
- `limit` (optional, default: 20)
- `offset` (optional, default: 0)
- `status` (optional: all, active, used, cancelled)
- `dateFrom` (optional: ISO 8601)
- `dateTo` (optional: ISO 8601)

**Response (200):**
```json
{
  "success": true,
  "tickets": [
    {
      "id": "uuid",
      "ticketNumber": "TKT-2026-001234",
      "routeNumber": "101",
      "amount": 50.00,
      "purchaseDate": "2026-02-10T10:30:00Z",
      "status": "active"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### 4. Share Ticket (Send via SMS/WhatsApp)
**POST** `/tickets/{ticketId}/share`

**Request Body:**
```json
{
  "method": "sms", // sms, whatsapp, email
  "recipient": "+94712345678" // or email
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Ticket shared successfully",
  "deliveryId": "uuid"
}
```

### 5. Validate Ticket for Boarding
**GET** `/tickets/{ticketId}/validate?timestamp=2026-02-10T10:30:00Z`

**Response (200):**
```json
{
  "success": true,
  "isValid": true,
  "ticket": { /* ticket details */ },
  "message": "Ticket is valid for boarding"
}
```

---

## USER PROFILE ENDPOINTS

### 1. Get User Profile
**GET** `/users/{userId}`

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "phoneNumber": "+94712345678",
    "role": "rider",
    "profileImageUrl": "https://...",
    "preferredLanguage": "en", // en, ta, si
    "createdAt": "2025-06-01T00:00:00Z",
    "updatedAt": "2026-02-10T10:30:00Z"
  }
}
```

### 2. Update User Profile
**PUT** `/users/{userId}`

**Request Body:**
```json
{
  "fullName": "Jane Doe",
  "phoneNumber": "+94787654321",
  "preferredLanguage": "ta",
  "profileImage": "base64_or_url"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": { /* updated user */ }
}
```

### 3. Get All User Transactions
**GET** `/users/{userId}/transactions?limit=50&dateFrom=2026-01-01&dateTo=2026-02-10`

**Response (200):**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "ticketId": "uuid",
      "amount": 50.00,
      "transactionDate": "2026-02-10T10:30:00Z",
      "status": "completed",
      "paymentMethod": "card"
    }
  ],
  "summary": {
    "totalTransactions": 45,
    "totalAmount": 2250.00,
    "averageAmount": 50.00
  }
}
```

---

## ROUTE ENDPOINTS

### 1. Create Route (Bus Owners)
**POST** `/routes`

**Request Body:**
```json
{
  "routeNumber": "101",
  "busNumber": "BUS-456",
  "stops": [
    { "name": "Central Station", "order": 1, "coordinates": { "lat": 6.927, "lng": 80.773 } },
    { "name": "Airport", "order": 2, "coordinates": { "lat": 7.189, "lng": 80.301 } }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "route": {
    "id": "uuid",
    "routeNumber": "101",
    "busNumber": "BUS-456",
    "createdBy": "uuid",
    "stops": [ /* stops array */ ],
    "createdAt": "2026-02-10T10:30:00Z"
  }
}
```

### 2. Get All Routes
**GET** `/routes?limit=20&offset=0&routeNumber=101&busNumber=BUS-456`

**Response (200):**
```json
{
  "success": true,
  "routes": [
    {
      "id": "uuid",
      "routeNumber": "101",
      "busNumber": "BUS-456",
      "stopCount": 5,
      "createdBy": "uuid",
      "createdAt": "2026-02-10T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 20,
    "offset": 0
  }
}
```

### 3. Get Route Details
**GET** `/routes/{routeId}`

**Response (200):**
```json
{
  "success": true,
  "route": {
    "id": "uuid",
    "routeNumber": "101",
    "busNumber": "BUS-456",
    "stops": [ /* full stops array */ ],
    "createdAt": "2026-02-10T10:30:00Z"
  }
}
```

### 4. Update Route
**PUT** `/routes/{routeId}`

**Request Body:** (same as create)

**Response (200):** (same as get details)

### 5. Delete Route
**DELETE** `/routes/{routeId}`

**Response (200):**
```json
{
  "success": true,
  "message": "Route deleted successfully"
}
```

### 6. Get Route Stops
**GET** `/routes/{routeId}/stops`

**Response (200):**
```json
{
  "success": true,
  "stops": [
    {
      "id": "uuid",
      "name": "Central Station",
      "sequence": 1,
      "coordinates": { "lat": 6.927, "lng": 80.773 }
    }
  ]
}
```

---

## DISCREPANCY ENDPOINTS

### 1. Get Discrepancies List
**GET** `/discrepancies?limit=20&offset=0&status=pending&routeNumber=101&busNumber=BUS-456&dateFrom=2026-01-01&dateTo=2026-02-10`

**Response (200):**
```json
{
  "success": true,
  "discrepancies": [
    {
      "id": "uuid",
      "routeNumber": "101",
      "busNumber": "BUS-456",
      "transactionDate": "2026-02-10",
      "expectedRevenue": 5000.00,
      "actualRevenue": 4500.00,
      "lossAmount": 500.00,
      "status": "pending",
      "createdAt": "2026-02-10T10:30:00Z"
    }
  ],
  "pagination": { /* ... */ },
  "summary": {
    "totalLoss": 5500.00,
    "countByStatus": { "pending": 5, "investigating": 2, "resolved": 1 }
  }
}
```

### 2. Get Discrepancy Details
**GET** `/discrepancies/{discrepancyId}`

**Response (200):**
```json
{
  "success": true,
  "discrepancy": {
    "id": "uuid",
    "routeId": "uuid",
    "routeNumber": "101",
    "busNumber": "BUS-456",
    "tripDate": "2026-02-10",
    "expectedRevenue": 5000.00,
    "actualRevenue": 4500.00,
    "lossAmount": 500.00,
    "status": "pending",
    "notes": "",
    "ticketsIssued": 100,
    "ticketsValidated": 98,
    "createdAt": "2026-02-10T10:30:00Z"
  }
}
```

### 3. Update Discrepancy Status
**PUT** `/discrepancies/{discrepancyId}/status`

**Request Body:**
```json
{
  "status": "investigating", // pending, investigating, resolved
  "notes": "Under investigation - driver interview pending"
}
```

**Response (200):**
```json
{
  "success": true,
  "discrepancy": { /* updated discrepancy */ }
}
```

### 4. Calculate Revenue Discrepancies
**POST** `/discrepancies/calculate`

**Request Body:**
```json
{
  "routeId": "uuid",
  "dateFrom": "2026-02-01",
  "dateTo": "2026-02-10"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Discrepancies calculated",
  "discrepancies": [ /* array of calculated discrepancies */ ]
}
```

### 5. Get Discrepancy Statistics
**GET** `/discrepancies/stats?dateFrom=2026-01-01&dateTo=2026-02-10&routeNumber=101`

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "totalDiscrepancies": 8,
    "totalLoss": 5500.00,
    "countByStatus": { "pending": 5, "investigating": 2, "resolved": 1 },
    "affectedRoutes": ["101", "102", "103"],
    "highestLossRoute": { "routeNumber": "101", "loss": 2000.00 }
  }
}
```

### 6. Send Alert to Bus Owner
**POST** `/discrepancies/{discrepancyId}/alert`

**Request Body:**
```json
{
  "method": "email", // email, sms, in_app
  "message": "Discrepancy detected on route 101"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Alert sent successfully",
  "alertId": "uuid"
}
```

---

## REPORT ENDPOINTS

### 1. Generate Daily Report
**POST** `/reports/daily`

**Request Body:**
```json
{
  "date": "2026-02-10",
  "includeRoutes": ["101", "102"], // optional, all if omitted
  "format": "json" // json, csv
}
```

**Response (201):**
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "type": "daily",
    "date": "2026-02-10",
    "summary": {
      "totalTransactions": 523,
      "totalRevenue": 26150.00,
      "ticketsSold": 523
    },
    "byRoute": [ /* breakdown per route */ ],
    "createdAt": "2026-02-10T10:30:00Z"
  }
}
```

### 2. Generate All-Time Report
**POST** `/reports/all-time`

**Request Body:**
```json
{
  "dateFrom": "2025-01-01",
  "dateTo": "2026-02-10",
  "includeRoutes": ["101", "102"], // optional
  "format": "json"
}
```

**Response (201):** (similar to daily report)

### 3. Generate Ticket Sales Report
**POST** `/reports/ticket-sales`

**Request Body:**
```json
{
  "dateFrom": "2026-02-01",
  "dateTo": "2026-02-10",
  "format": "csv" // or json
}
```

**Response (201):**
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "type": "ticket_sales",
    "dateRange": { "from": "2026-02-01", "to": "2026-02-10" },
    "columns": ["ticket_id", "date", "route_id", "stop", "amount"],
    "rowCount": 4532,
    "downloadUrl": "https://.../reports/uuid/download"
  }
}
```

### 4. Get Report Details
**GET** `/reports/{reportId}`

**Response (200):**
```json
{
  "success": true,
  "report": { /* report data */ }
}
```

### 5. Export Report as CSV
**GET** `/reports/{reportId}/export`

**Response (200):** CSV file download

---

## DASHBOARD ENDPOINTS

### 1. Get Dashboard Metrics
**GET** `/dashboard/metrics?dateFrom=2026-02-01&dateTo=2026-02-10`

**Response (200):**
```json
{
  "success": true,
  "metrics": {
    "totalRevenue": 52300.00,
    "totalTransactions": 1046,
    "totalLoss": 1200.00,
    "totalDiscrepancies": 8,
    "avgTransactionValue": 50.00
  }
}
```

### 2. Get Revenue Summary
**GET** `/dashboard/revenue-summary?period=monthly&year=2026`

**Response (200):**
```json
{
  "success": true,
  "summary": [
    { "month": "January", "revenue": 150000.00, "transactions": 3000 },
    { "month": "February", "revenue": 52300.00, "transactions": 1046 }
  ]
}
```

### 3. Get Transaction Count
**GET** `/dashboard/transaction-count?dateFrom=2026-02-01&dateTo=2026-02-10`

**Response (200):**
```json
{
  "success": true,
  "totalTransactions": 1046,
  "byRoute": {
    "101": 250,
    "102": 320,
    "103": 476
  }
}
```

### 4. Get Revenue Loss Summary
**GET** `/dashboard/revenue-loss?dateFrom=2026-02-01&dateTo=2026-02-10`

**Response (200):**
```json
{
  "success": true,
  "totalLoss": 1200.00,
  "byRoute": {
    "101": 400.00,
    "102": 350.00,
    "103": 450.00
  },
  "affectedRoutes": 3
}
```

---

## AUDIT LOG ENDPOINTS

### 1. Get Audit Logs
**GET** `/audit/logs?limit=50&offset=0&userId=uuid&action=create&dateFrom=2026-02-01&dateTo=2026-02-10`

**Response (200):**
```json
{
  "success": true,
  "logs": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userName": "John Doe",
      "action": "create", // create, update, delete, login, download
      "resource": "discrepancy",
      "resourceId": "uuid",
      "details": { /* action details */ },
      "ipAddress": "192.168.1.1",
      "timestamp": "2026-02-10T10:30:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

### 2. Get User Activity Log
**GET** `/audit/logs/user/{userId}?limit=50&offset=0&dateFrom=2026-02-01&dateTo=2026-02-10`

**Response (200):** (same as audit logs)

---

## ERROR RESPONSES

All error responses follow this format:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "INVALID_INPUT",
  "message": "Email is required",
  "timestamp": "2026-02-10T10:30:00Z"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired token",
  "timestamp": "2026-02-10T10:30:00Z"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "You don't have permission to access this resource",
  "timestamp": "2026-02-10T10:30:00Z"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Ticket not found",
  "timestamp": "2026-02-10T10:30:00Z"
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Too many requests. Please try again later",
  "retryAfter": 60,
  "timestamp": "2026-02-10T10:30:00Z"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "SERVER_ERROR",
  "message": "An internal server error occurred",
  "timestamp": "2026-02-10T10:30:00Z"
}
```

---

## RATE LIMITING

- **Standard endpoints**: 100 requests/minute per IP
- **Auth endpoints**: 5 requests/minute per IP (brute force protection)
- **SMS/Email endpoints**: 10 requests/minute per user
- **Download endpoints**: 5 requests/minute per user

---

## PAGINATION

All list endpoints use cursor or offset-based pagination:

**Request:**
```
GET /endpoint?limit=20&offset=0
or
GET /endpoint?limit=20&cursor=next_cursor_value
```

**Response includes:**
```json
{
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 245,
    "hasMore": true,
    "cursor": "next_cursor_value" // if cursor-based
  }
}
```

---

## SORTING

Most endpoints support sorting:

**Request:**
```
GET /endpoint?sortBy=createdAt&sortOrder=desc
```

**Valid sortBy values by endpoint**: Check specific endpoint documentation

---

## WEBHOOK EVENTS (Future)

Webhooks for real-time notifications:
- `ticket.purchased`
- `discrepancy.detected`
- `discrepancy.status_changed`
- `report.generated`
- `user.registered`
