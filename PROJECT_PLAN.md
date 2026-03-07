# Bus Ticketing & Revenue Reconciliation System - Project Plan

## Executive Overview
- **Mobile App**: Consumer-facing ticket purchasing & profile management (React TS + Vite + Tailwind)
- **Back Office Portal**: Admin dashboard for revenue reconciliation, auditing & reporting (React TS + Vite + Tailwind)
- **Backend API**: Go Fiber with microservices architecture
- **Data Layer**: MongoDB (documents/audit logs) + Supabase PostgreSQL (transactional) + Supabase Auth
- **Communications**: Supabase SMTP (email alerts) + Twilio/AWS SNS (SMS/OTP)
- **State Management**: Redux (both frontends)
- **HTTP Client**: Axios with interceptors for auth

**Requirements Mapping:**
- Requirements 01-10: Mobile app features
- Requirements 11-37: Back office portal features

---

## 1. PROJECT STRUCTURE

```
fyp-bus-ticketing/
├── mobile-app/                    # Consumer app (Req 01-10)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/                 # Redux
│   │   ├── utils/
│   │   └── types/
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── back-office-portal/            # Admin/Back office (Req 11-37)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/                 # Redux
│   │   ├── utils/
│   │   └── types/
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                       # Go Fiber API
│   ├── main.go
│   ├── handlers/
│   │   ├── auth.go
│   │   ├── tickets.go
│   │   ├── users.go
│   │   ├── discrepancies.go
│   │   ├── reports.go
│   │   └── routes.go
│   ├── models/
│   ├── middleware/
│   ├── database/
│   ├── services/
│   ├── go.mod
│   └── go.sum
│
├── docs/
│   ├── API_SPEC.md
│   ├── DB_SCHEMA.md
│   └── DEPLOYMENT.md
└── README.md
```

---

## 2. MOBILE APP (Consumer) - Requirements 01-10

### Key Features
| Req | Feature | Status |
|-----|---------|--------|
| 01 | Login with email/password | Core |
| 02 | Create account | Core |
| 03 | OTP on signup (SMS) | Core |
| 04 | Purchase ticket | Core |
| 05 | Account validation for purchases | Core |
| 06 | View transaction history | Core |
| 07 | Send ticket via SMS/WhatsApp | Core |
| 08 | View user profile | Core |
| 09 | Edit profile | Core |
| 10 | Multi-language support (Tamil, English, Sinhala) | Core |

### Pages/Screens
1. **Auth Stack**
   - Login screen
   - Register screen
   - OTP verification screen
   - Password reset

2. **Main Stack**
   - Dashboard (Quick purchase, recent tickets)
   - Ticket Purchase Flow (Route selection → Stops → Passenger count → Payment)
   - Ticket Details & Share
   - Transaction History
   - User Profile (View & Edit)
   - Settings (Language, notifications, logout)

### State Management (Redux)
```
auth/
  - user state
  - isAuthenticated
  - token
  
tickets/
  - purchasedTickets
  - currentTicket
  - loading
  
profile/
  - userData
  - preferences
  
ui/
  - selectedLanguage
  - theme
```

### Components
- AuthGuard (Protected routes)
- LanguageSwitcher
- TicketCard
- TransactionList
- PurchaseWizard
- ProfileForm

### Services
- `authService.ts` - Supabase auth API calls
- `ticketService.ts` - Purchase, history, ticket details
- `profileService.ts` - User profile CRUD
- `notificationService.ts` - SMS/WhatsApp integration

---

## 3. BACK OFFICE PORTAL (Admin) - Requirements 11-37

### Key Features
| Req | Feature | Portal |
|-----|---------|--------|
| 11-12 | Account creation & login | All users |
| 13 | Sales summary dashboard | All users |
| 14-20 | Discrepancy records & filtering | Accountants |
| 21-22 | Route information management | Bus owners/Accountants |
| 23-26 | Report generation (CSV export) | All users |
| 27-33 | Revenue metrics & transaction details | All users |
| 34 | Transaction details per user | Accountants |
| 35 | Audit logs | Bus owners |
| 36-37 | Alerts & email notifications | Bus owners |

### Pages
1. **Dashboard**
   - KPI Cards: Total Revenue, Total Transactions, Revenue Loss, Total Discrepancies
   - Sales chart (Today vs All-time)
   - Recent alerts widget
   - Quick filters (by date, route, bus)

2. **Discrepancy Management**
   - Table view with sorting/filtering (status, route, bus, date)
   - Detailed view modal (expected revenue, actual revenue, loss calculation)
   - Status workflow (Pending → Investigating → Resolved)
   - Batch operations

3. **Routes Management** (Bus owners only)
   - Create/edit/delete routes
   - Route details (route number, stops, buses assigned)
   - Trip information tracking

4. **Reports**
   - Filters: Date range, route, bus, transaction type
   - Report templates: Daily, All-time, Ticket sales
   - CSV export functionality
   - Preview & download

5. **Audit Logs** (Bus owners only)
   - User activity log
   - System event log
   - Filters: user, date range, action type

6. **Settings**
   - User management (if admin)
   - Notification preferences
   - Multi-language support

### State Management (Redux)
```
dashboard/
  - metrics
  - charts
  
discrepancies/
  - list
  - filters
  - currentRecord
  - loading
  
routes/
  - list
  - currentRoute
  - buses
  
reports/
  - selectedTemplate
  - filters
  - generatedReport
  
auditLogs/
  - logs
  - filters
  
users/
  - currentUser
  - role
  - permissions
```

### Components
- Dashboard KPI Cards
- DiscrepancyTable with filters
- RouteForm
- ReportBuilder
- AuditLogViewer
- ExportButton (CSV)
- StatusBadge (Pending/Investigating/Resolved)
- DateRangeFilter

### Services
- `dashboardService.ts` - Metrics & KPIs
- `discrepancyService.ts` - CRUD & filtering
- `routeService.ts` - Route management
- `reportService.ts` - Generate & export reports
- `auditService.ts` - Fetch audit logs
- `userService.ts` - User management

---

## 4. BACKEND API (Go Fiber)

### Core Modules

#### Authentication (`auth.go`)
- POST `/auth/register` - User registration with OTP
- POST `/auth/verify-otp` - Verify OTP (Supabase SMS)
- POST `/auth/login` - Email/password login
- POST `/auth/refresh-token` - Token refresh
- POST `/auth/logout` - Logout

#### Tickets (`tickets.go`)
- POST `/tickets/purchase` - Create ticket purchase
- GET `/tickets/:ticketId` - Get ticket details
- GET `/tickets/user/:userId` - Get user's transaction history
- POST `/tickets/:ticketId/share` - Send ticket via SMS/WhatsApp
- GET `/tickets/validate` - Validate ticket for boarding

#### Routes & Stops (`routes.go`)
- POST `/routes` - Create route (bus owners)
- GET `/routes` - List all routes (with filters)
- GET `/routes/:routeId` - Get route details
- PUT `/routes/:routeId` - Update route
- DELETE `/routes/:routeId` - Delete route
- GET `/routes/:routeId/stops` - Get stops for route
- GET `/routes/:routeId/buses` - Get assigned buses

#### Discrepancies (`discrepancies.go`)
- GET `/discrepancies` - List with filtering
- GET `/discrepancies/:id` - Get details
- PUT `/discrepancies/:id/status` - Update status
- POST `/discrepancies/calculate` - Calculate revenue vs actual
- GET `/discrepancies/stats` - Summary statistics
- POST `/discrepancies/alert` - Trigger alert to bus owner

#### Reports (`reports.go`)
- POST `/reports/daily` - Generate daily report
- POST `/reports/all-time` - Generate all-time report
- POST `/reports/ticket-sales` - Generate ticket sales report
- GET `/reports/:reportId` - Get report details
- POST `/reports/:reportId/export` - Export as CSV

#### Dashboard (`dashboard.go`)
- GET `/dashboard/metrics` - KPI data
- GET `/dashboard/revenue-summary` - Revenue stats by period
- GET `/dashboard/transaction-count` - Total transactions
- GET `/dashboard/revenue-loss` - Total loss

#### Audit Logs (`audit.go`)
- GET `/audit/logs` - Get audit logs with filters
- GET `/audit/logs/user/:userId` - Get user activity

#### User Profile (`users.go`)
- GET `/users/:userId` - Get profile
- PUT `/users/:userId` - Update profile
- GET `/users/:userId/transactions` - Get all transactions

### Middleware
- `auth.go` - JWT verification
- `cors.go` - CORS handling
- `logger.go` - Request logging (audit trail)
- `errorHandler.go` - Global error handling
- `rateLimiter.go` - Rate limiting

### Database Layer (`database/`)
- MongoDB connection for documents (tickets, transactions, logs)
- PostgreSQL (Supabase) for transactional data
- Connection pooling & error handling

### Models (`models/`)
```go
// Key structs
type User struct { ID, Email, FullName, PhoneNumber, Role, CreatedAt }
type Ticket struct { ID, UserID, RouteID, PurchaseDate, Amount, Status }
type Route struct { ID, RouteNumber, BusNumber, Stops, CreatedBy }
type Discrepancy struct { ID, RouteID, BusNumber, ExpectedRevenue, ActualRevenue, Status, Date }
type Transaction struct { ID, UserID, TicketID, Amount, Date }
type Report struct { ID, Type, DateRange, Data, CreatedAt, ExportFormat }
type AuditLog struct { ID, UserID, Action, Resource, Timestamp }
```

---

## 5. DATABASE SCHEMA

### MongoDB Collections (Document Storage)
```
- transaction_logs
  { _id, userId, ticketId, amount, currency, timestamp, metadata }

- ticket_documents
  { _id, ticketId, routeId, stops, passengerInfo, qrCode, timestamp }

- notification_logs
  { _id, userId, type (SMS/Email), content, status, timestamp }

- audit_logs
  { _id, userId, action, resource, details, ipAddress, timestamp }
```

### PostgreSQL Tables (Supabase)
```
users
  - id (UUID, PK)
  - email (UNIQUE)
  - full_name
  - phone_number
  - role (rider, bus_owner, accountant, admin)
  - created_at
  - updated_at

routes
  - id (UUID, PK)
  - route_number
  - bus_number
  - created_by (FK: users.id)
  - created_at
  - updated_at

stops
  - id (UUID, PK)
  - route_id (FK: routes.id)
  - stop_name
  - sequence_order
  - location_coordinates

tickets
  - id (UUID, PK)
  - user_id (FK: users.id)
  - route_id (FK: routes.id)
  - from_stop_id (FK: stops.id)
  - to_stop_id (FK: stops.id)
  - purchase_date
  - amount
  - status (active, used, cancelled)
  - qr_code_hash
  - created_at

transactions
  - id (UUID, PK)
  - user_id (FK: users.id)
  - ticket_id (FK: tickets.id)
  - amount
  - transaction_date
  - payment_method
  - status (completed, pending, failed)
  - created_at

discrepancies
  - id (UUID, PK)
  - route_id (FK: routes.id)
  - bus_number
  - transaction_date
  - expected_revenue
  - actual_revenue
  - loss_amount
  - status (pending, investigating, resolved)
  - created_at
  - updated_at

reports
  - id (UUID, PK)
  - report_type (daily, all_time, ticket_sales)
  - date_from
  - date_to
  - data_json
  - created_at
  - created_by (FK: users.id)

alert_settings
  - id (UUID, PK)
  - user_id (FK: users.id)
  - alert_type (email, sms, in_app)
  - enabled
  - created_at
```

---

## 6. TECHNOLOGY RATIONALE

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Frontend** | React TS + Vite | Type safety, fast build, great DX |
| **State** | Redux | Predictable state management, DevTools |
| **Styling** | Tailwind CSS | Utility-first, rapid UI development |
| **HTTP** | Axios | Promise-based, interceptors for auth |
| **Backend** | Go Fiber | High performance, concurrent handling of SMS/Email |
| **Auth** | Supabase Auth | Built-in JWT, Row Level Security (RLS) |
| **SQL DB** | Supabase PostgreSQL | ACID compliance, relational integrity |
| **NoSQL** | MongoDB | Flexible schema for audit/transaction logs |
| **Communications** | Supabase SMTP/SMS | Integrated, reliable delivery |
| **Deployment** | Docker + Cloud | Easy scaling & orchestration |

---

## 7. DEVELOPMENT PHASES

### Phase 1: Foundation (Weeks 1-2)
- [ ] Backend scaffold (Go Fiber, DB connections)
- [ ] Database schema finalization
- [ ] Frontend project setup (both apps)
- [ ] Redux store structure

### Phase 2: Core Auth & APIs (Weeks 3-4)
- [ ] Authentication (Supabase + OTP)
- [ ] User profile management
- [ ] Basic CRUD endpoints
- [ ] Mobile: Login/Register flows

### Phase 3: Mobile Features (Weeks 5-6)
- [ ] Ticket purchase workflow
- [ ] Transaction history
- [ ] Ticket sharing (SMS)
- [ ] Multi-language support
- [ ] Mobile responsiveness testing

### Phase 4: Back Office - Dashboard (Weeks 7-8)
- [ ] Dashboard KPIs & charts
- [ ] Role-based access (RBAC)
- [ ] Metrics aggregation
- [ ] Initial filtering & search

### Phase 5: Back Office - Discrepancies & Reporting (Weeks 9-10)
- [ ] Discrepancy tracking & status workflow
- [ ] Report generation engine
- [ ] CSV export functionality
- [ ] Filtering & bulk operations

### Phase 6: Alerts & Audit Logs (Weeks 11-12)
- [ ] Email/SMS alert system
- [ ] Audit log aggregation
- [ ] Real-time notifications (WebSocket/polling)

### Phase 7: Testing & Optimization (Weeks 13-14)
- [ ] Unit tests (backend)
- [ ] Integration tests
- [ ] Performance optimization
- [ ] Security audit

### Phase 8: Deployment & Documentation (Week 15-16)
- [ ] Docker containerization
- [ ] CI/CD pipeline setup
- [ ] Documentation & handover

---

## 8. KEY IMPLEMENTATION NOTES

### Mobile App
- **Responsive Design**: Use mobile-first Tailwind breakpoints
- **Offline Support**: Consider service workers for ticket viewing
- **Deep Linking**: QR code scanning for tickets
- **Biometric Auth**: Optional fingerprint/face recognition for future

### Back Office Portal
- **Responsive Dashboard**: Charts using Recharts or Chart.js
- **Data Virtualization**: Large tables use react-window for performance
- **Real-time Updates**: WebSocket for alerts & live metrics
- **Export Optimization**: Streaming CSV for large datasets

### Backend
- **Rate Limiting**: Protect SMS/Email endpoints
- **Caching**: Redis for frequently accessed routes/metrics
- **Background Jobs**: Scheduled report generation, alert sending
- **Logging**: Structured logging for audit compliance

### Security
- **JWT Tokens**: Supabase handles issuance & refresh
- **HTTPS Only**: All API calls encrypted
- **Input Validation**: Backend validation before DB operations
- **CORS**: Strict origin policies
- **RLS**: Supabase PostgreSQL row-level security for multi-tenancy

---

## 9. API VERSIONING & DOCUMENTATION

All endpoints prefixed with `/api/v1/`

Swagger/OpenAPI documentation at `/api/v1/docs`

---

## 10. NEXT STEPS

1. ✅ Review this plan with stakeholders
2. ⏳ Set up Git repository structure
3. ⏳ Initialize Vite projects with configs
4. ⏳ Create Go Fiber boilerplate
5. ⏳ Set up Supabase project & authentication
6. ⏳ Begin Phase 1 implementation
