# Requirements to Implementation Mapping

## MOBILE APP REQUIREMENTS (01-10)

### Frontend Architecture - Mobile App

#### Required Features Breakdown:

| Req | Feature | Component | Redux Slice | API Endpoint | Priority |
|-----|---------|-----------|-------------|--------------|----------|
| 01 | Login (email/pwd) | LoginScreen | auth | POST /auth/login | P0 |
| 02 | Create account | RegisterScreen | auth | POST /auth/register | P0 |
| 03 | OTP verification | OTPScreen | auth | POST /auth/verify-otp | P0 |
| 04 | Purchase ticket | TicketPurchaseFlow | tickets | POST /tickets/purchase | P0 |
| 05 | Validate account before purchase | PurchaseGuard middleware | auth | N/A (middleware) | P0 |
| 06 | View transactions | TransactionHistoryScreen | tickets | GET /tickets/user/{userId} | P0 |
| 07 | Share ticket via SMS | TicketShare action | tickets | POST /tickets/{id}/share | P1 |
| 08 | View user profile | ProfileScreen | profile | GET /users/{userId} | P0 |
| 09 | Edit profile | ProfileEditScreen | profile | PUT /users/{userId} | P0 |
| 10 | Multi-language (Tamil, English, Sinhala) | LanguageProvider, i18n | ui | N/A (client-side) | P0 |

### Mobile App File Structure

```
mobile-app/
├── src/
│   ├── assets/
│   │   ├── locales/
│   │   │   ├── en.json
│   │   │   ├── ta.json (Tamil)
│   │   │   └── si.json (Sinhala)
│   │   └── icons/
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   └── AuthGuard.tsx
│   │   │
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── OTPInput.tsx
│   │   │   └── PasswordReset.tsx
│   │   │
│   │   ├── Tickets/
│   │   │   ├── TicketPurchaseWizard.tsx
│   │   │   ├── TicketCard.tsx
│   │   │   ├── RouteSelector.tsx
│   │   │   ├── StopSelector.tsx
│   │   │   ├── PassengerInput.tsx
│   │   │   ├── PaymentForm.tsx
│   │   │   └── TicketConfirmation.tsx
│   │   │
│   │   ├── Profile/
│   │   │   ├── ProfileDisplay.tsx
│   │   │   ├── ProfileEditForm.tsx
│   │   │   └── ProfilePhotoUpload.tsx
│   │   │
│   │   ├── Transactions/
│   │   │   ├── TransactionList.tsx
│   │   │   ├── TransactionFilter.tsx
│   │   │   └── TransactionDetail.tsx
│   │   │
│   │   └── Common/
│   │       ├── LanguageSwitcher.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── ConfirmDialog.tsx
│   │       └── Toast.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── OTPPage.tsx
│   │   │
│   │   ├── home/
│   │   │   └── HomePage.tsx
│   │   │
│   │   ├── tickets/
│   │   │   ├── PurchasePage.tsx
│   │   │   ├── TicketDetailPage.tsx
│   │   │   └── TransactionsPage.tsx
│   │   │
│   │   ├── profile/
│   │   │   ├── ProfilePage.tsx
│   │   │   └── EditProfilePage.tsx
│   │   │
│   │   └── settings/
│   │       ├── SettingsPage.tsx
│   │       └── LanguageSettingsPage.tsx
│   │
│   ├── services/
│   │   ├── api.ts (Axios instance with interceptors)
│   │   ├── authService.ts (Req 01-03)
│   │   ├── ticketService.ts (Req 04-07)
│   │   ├── profileService.ts (Req 08-09)
│   │   ├── smsService.ts (Req 03, 07)
│   │   ├── storageService.ts (LocalStorage/secure storage)
│   │   └── validationService.ts
│   │
│   ├── store/ (Redux)
│   │   ├── index.ts
│   │   ├── rootReducer.ts
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   │   - user
│   │   │   │   - isAuthenticated
│   │   │   │   - token
│   │   │   │   - refreshToken
│   │   │   │   - loading
│   │   │   │
│   │   │   ├── ticketsSlice.ts
│   │   │   │   - purchasedTickets
│   │   │   │   - currentTicket
│   │   │   │   - transactionHistory
│   │   │   │   - filters
│   │   │   │   - loading
│   │   │   │
│   │   │   ├── profileSlice.ts
│   │   │   │   - userData
│   │   │   │   - preferences
│   │   │   │   - lastUpdated
│   │   │   │
│   │   │   ├── uiSlice.ts
│   │   │   │   - selectedLanguage
│   │   │   │   - theme
│   │   │   │   - notifications
│   │   │   │
│   │   │   └── loadingSlice.ts
│   │   │       - globalLoading
│   │   │       - errors
│   │   │
│   │   └── middleware/
│   │       ├── authMiddleware.ts
│   │       └── errorMiddleware.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── ticket.ts
│   │   ├── user.ts
│   │   ├── api.ts
│   │   └── common.ts
│   │
│   ├── utils/
│   │   ├── axios.ts (Axios configuration with interceptors)
│   │   ├── constants.ts
│   │   ├── dateFormatter.ts
│   │   ├── validators.ts (Email, phone, password strength)
│   │   ├── token.ts (JWT handling)
│   │   └── i18n.ts (Internationalization setup)
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTickets.ts
│   │   ├── useProfile.ts
│   │   ├── useLanguage.ts
│   │   └── usePagination.ts
│   │
│   ├── App.tsx
│   └── index.tsx
│
├── public/
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### Mobile App Redux Flow (State Management)

```typescript
// auth slice example
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// tickets slice example
interface TicketsState {
  purchased: Ticket[];
  currentTicket: Ticket | null;
  transactionHistory: Transaction[];
  filters: { dateFrom: Date; dateTo: Date };
  loading: boolean;
  error: string | null;
}
```

### Mobile App Dependencies

```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x",
  "@reduxjs/toolkit": "^1.9.x",
  "react-redux": "^8.x",
  "axios": "^1.6.x",
  "tailwindcss": "^3.x",
  "@heroicons/react": "^2.x",
  "react-i18next": "^13.x",
  "i18next": "^23.x",
  "date-fns": "^2.x"
}
```

---

## BACK OFFICE PORTAL REQUIREMENTS (11-37)

### Frontend Architecture - Back Office Portal

#### Features by Use Case:

| Req | Feature | Page/Component | Redux Slice | API Endpoint | Role | Priority |
|-----|---------|----------------|-------------|--------------|------|----------|
| 11 | Create account | RegisterPage | auth | POST /auth/register | All | P0 |
| 12 | Login | LoginPage | auth | POST /auth/login | All | P0 |
| 13 | Sales summary dashboard | DashboardPage | dashboard | GET /dashboard/metrics | All | P0 |
| 14 | View total discrepancies | DashboardKPI | dashboard | GET /discrepancies/stats | Accountant | P1 |
| 15 | Detailed discrepancy records | DiscrepancyListPage | discrepancies | GET /discrepancies | Accountant | P1 |
| 16 | Revenue reconciliation (expected vs actual) | DiscrepancyDetailModal | discrepancies | GET /discrepancies/{id} | Accountant | P1 |
| 17 | Discrepancy includes trip info | DiscrepancyTable | discrepancies | GET /discrepancies | Accountant | P1 |
| 18 | Status workflow (Pending/Investigating/Resolved) | StatusUpdateForm | discrepancies | PUT /discrepancies/{id}/status | Accountant | P1 |
| 19 | Filter by status | DiscrepancyFilter | discrepancies | GET /discrepancies?status=... | Accountant | P1 |
| 20 | Filter by route/bus | DiscrepancyFilter | discrepancies | GET /discrepancies?route=...&bus=... | Accountant | P1 |
| 21 | Create/edit route info | RouteFormPage | routes | POST/PUT /routes | Bus Owner | P1 |
| 22 | View route info | RouteDetailsPage | routes | GET /routes | Accountant | P1 |
| 23 | Generate daily transaction report | ReportBuilderPage | reports | POST /reports/daily | All | P2 |
| 24 | Generate all-time transaction report | ReportBuilderPage | reports | POST /reports/all-time | All | P2 |
| 25 | Generate ticket sales report | ReportBuilderPage | reports | POST /reports/ticket-sales | All | P2 |
| 26 | Export reports as CSV | ExportButton | reports | POST /reports/{id}/export | All | P2 |
| 27 | Filter discrepancies by date | DiscrepancyFilter | discrepancies | GET /discrepancies?dateFrom=...&dateTo=... | Accountant | P1 |
| 28 | View total revenue generated | DashboardKPI | dashboard | GET /dashboard/revenue-summary | All | P0 |
| 29 | View revenue for specific day | DashboardMetrics | dashboard | GET /dashboard/revenue-summary?date=... | All | P0 |
| 30 | View total transaction count | DashboardKPI | dashboard | GET /dashboard/transaction-count | All | P0 |
| 31 | View detailed transaction records | TransactionListPage | transactions | GET /transactions | Accountant | P2 |
| 32 | View revenue loss | DashboardKPI | dashboard | GET /dashboard/revenue-loss | All | P0 |
| 33 | Record all transaction details | N/A (backend) | - | POST /transactions | N/A | P0 |
| 34 | View transaction details for user | UserTransactionsPage | transactions | GET /transactions?userId=... | Accountant | P2 |
| 35 | View audit logs | AuditLogsPage | auditLogs | GET /audit/logs | Bus Owner | P2 |
| 36 | In-app alerts for discrepancies | AlertWidget, NotificationCenter | alerts | WebSocket /notifications | Bus Owner | P2 |
| 37 | Email alerts at 12 AM | N/A (scheduled backend job) | - | (background job) | Bus Owner | P2 |

### Back Office Portal File Structure

```
back-office-portal/
├── src/
│   ├── assets/
│   │   ├── locales/
│   │   │   ├── en.json
│   │   │   ├── ta.json (Tamil)
│   │   │   └── si.json (Sinhala)
│   │   └── icons/
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MainLayout.tsx
│   │   │   └── AuthGuard.tsx
│   │   │
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── PasswordReset.tsx
│   │   │   └── RoleSelector.tsx
│   │   │
│   │   ├── Dashboard/ (Req 13, 28-32)
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── KPICard.tsx (Total revenue, transactions, loss, discrepancies)
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── TransactionChart.tsx
│   │   │   ├── AlertsWidget.tsx (Req 36)
│   │   │   └── QuickFilters.tsx
│   │   │
│   │   ├── Discrepancies/ (Req 14-20, 27)
│   │   │   ├── DiscrepancyListPage.tsx
│   │   │   ├── DiscrepancyTable.tsx (with sorting & filtering)
│   │   │   ├── DiscrepancyDetailModal.tsx (Req 16 - expected vs actual revenue)
│   │   │   ├── DiscrepancyFilter.tsx (status, route, bus, date)
│   │   │   ├── StatusUpdateForm.tsx (Req 18 - Pending/Investigating/Resolved)
│   │   │   ├── BulkActionsBar.tsx
│   │   │   └── DiscrepancyStats.tsx (Req 14)
│   │   │
│   │   ├── Routes/ (Req 21-22)
│   │   │   ├── RoutesListPage.tsx
│   │   │   ├── RouteTable.tsx
│   │   │   ├── RouteFormModal.tsx
│   │   │   ├── RouteDetailsModal.tsx
│   │   │   ├── RouteStopsManager.tsx
│   │   │   └── BusAssignmentForm.tsx
│   │   │
│   │   ├── Reports/ (Req 23-26)
│   │   │   ├── ReportBuilderPage.tsx
│   │   │   ├── ReportTemplateSelector.tsx (Daily, All-time, Ticket sales)
│   │   │   ├── ReportFilters.tsx (date range, route, bus, transaction type)
│   │   │   ├── ReportPreview.tsx
│   │   │   ├── ExportButton.tsx (CSV export)
│   │   │   ├── ReportHistoryTable.tsx
│   │   │   └── CSVExporter.ts (utility)
│   │   │
│   │   ├── Transactions/ (Req 31, 34)
│   │   │   ├── TransactionListPage.tsx
│   │   │   ├── TransactionTable.tsx
│   │   │   ├── TransactionFilter.tsx
│   │   │   ├── TransactionDetailModal.tsx
│   │   │   └── UserTransactionsPage.tsx
│   │   │
│   │   ├── AuditLogs/ (Req 35)
│   │   │   ├── AuditLogsPage.tsx
│   │   │   ├── AuditLogsTable.tsx
│   │   │   ├── AuditLogFilter.tsx (user, date range, action type)
│   │   │   └── AuditLogViewer.tsx
│   │   │
│   │   ├── Common/
│   │   │   ├── DataTable.tsx (reusable table component)
│   │   │   ├── FilterBar.tsx
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── LanguageSwitcher.tsx
│   │   │   ├── UserMenu.tsx
│   │   │   ├── NotificationCenter.tsx (Req 36)
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── Toast.tsx
│   │   │
│   │   └── Charts/
│   │       ├── BarChart.tsx
│   │       ├── LineChart.tsx
│   │       └── PieChart.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ForgotPasswordPage.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   │
│   │   ├── discrepancies/
│   │   │   ├── DiscrepancyListPage.tsx
│   │   │   └── DiscrepancyDetailPage.tsx
│   │   │
│   │   ├── routes/
│   │   │   ├── RoutesListPage.tsx
│   │   │   └── RouteDetailPage.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── ReportBuilderPage.tsx
│   │   │   └── ReportDetailPage.tsx
│   │   │
│   │   ├── transactions/
│   │   │   ├── TransactionsPage.tsx
│   │   │   └── UserTransactionsPage.tsx
│   │   │
│   │   ├── auditLogs/
│   │   │   └── AuditLogsPage.tsx
│   │   │
│   │   └── settings/
│   │       ├── SettingsPage.tsx
│   │       └── LanguageSettingsPage.tsx
│   │
│   ├── services/
│   │   ├── api.ts (Axios instance with interceptors)
│   │   ├── authService.ts (Req 11-12)
│   │   ├── dashboardService.ts (Req 13, 28-32)
│   │   ├── discrepancyService.ts (Req 14-20, 27)
│   │   ├── routeService.ts (Req 21-22)
│   │   ├── reportService.ts (Req 23-26)
│   │   ├── transactionService.ts (Req 31, 34)
│   │   ├── auditService.ts (Req 35)
│   │   ├── alertService.ts (Req 36)
│   │   ├── csvExportService.ts
│   │   ├── storageService.ts
│   │   └── validationService.ts
│   │
│   ├── store/ (Redux)
│   │   ├── index.ts
│   │   ├── rootReducer.ts
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   │   - user
│   │   │   │   - isAuthenticated
│   │   │   │   - token
│   │   │   │   - role
│   │   │   │   - permissions
│   │   │   │
│   │   │   ├── dashboardSlice.ts
│   │   │   │   - metrics (revenue, transactions, loss, discrepancies)
│   │   │   │   - period (today, week, month, all-time)
│   │   │   │   - charts
│   │   │   │   - loading
│   │   │   │
│   │   │   ├── discrepanciesSlice.ts
│   │   │   │   - list
│   │   │   │   - currentRecord
│   │   │   │   - filters (status, route, bus, date range)
│   │   │   │   - pagination
│   │   │   │   - loading
│   │   │   │
│   │   │   ├── routesSlice.ts
│   │   │   │   - list
│   │   │   │   - currentRoute
│   │   │   │   - buses
│   │   │   │   - stops
│   │   │   │   - loading
│   │   │   │
│   │   │   ├── reportsSlice.ts
│   │   │   │   - templates
│   │   │   │   - selectedTemplate
│   │   │   │   - filters
│   │   │   │   - generatedReport
│   │   │   │   - exportFormats
│   │   │   │   - loading
│   │   │   │
│   │   │   ├── transactionsSlice.ts
│   │   │   │   - list
│   │   │   │   - filters
│   │   │   │   - pagination
│   │   │   │   - loading
│   │   │   │
│   │   │   ├── auditLogsSlice.ts
│   │   │   │   - logs
│   │   │   │   - filters (user, date, action)
│   │   │   │   - pagination
│   │   │   │   - loading
│   │   │   │
│   │   │   ├── alertsSlice.ts
│   │   │   │   - notifications
│   │   │   │   - unreadCount
│   │   │   │
│   │   │   ├── uiSlice.ts
│   │   │   │   - selectedLanguage
│   │   │   │   - theme
│   │   │   │   - sidebarOpen
│   │   │   │
│   │   │   └── loadingSlice.ts
│   │   │       - globalLoading
│   │   │       - errors
│   │   │
│   │   └── middleware/
│   │       ├── authMiddleware.ts
│   │       ├── roleMiddleware.ts (RBAC)
│   │       ├── notificationMiddleware.ts
│   │       └── errorMiddleware.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── dashboard.ts
│   │   ├── discrepancy.ts
│   │   ├── route.ts
│   │   ├── report.ts
│   │   ├── transaction.ts
│   │   ├── auditLog.ts
│   │   ├── api.ts
│   │   └── common.ts
│   │
│   ├── utils/
│   │   ├── axios.ts (Axios configuration with interceptors)
│   │   ├── constants.ts
│   │   ├── dateFormatter.ts
│   │   ├── numberFormatter.ts
│   │   ├── csvExporter.ts
│   │   ├── validators.ts
│   │   ├── token.ts (JWT handling)
│   │   ├── i18n.ts (Internationalization setup)
│   │   └── rbac.ts (Role-based access control)
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useRole.ts (RBAC)
│   │   ├── useDashboard.ts
│   │   ├── useDiscrepancies.ts
│   │   ├── useReports.ts
│   │   ├── useAuditLogs.ts
│   │   ├── useLanguage.ts
│   │   ├── useNotifications.ts (WebSocket)
│   │   └── usePagination.ts
│   │
│   ├── App.tsx
│   └── index.tsx
│
├── public/
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### Back Office Portal Redux Flow

```typescript
// dashboard slice example (Req 13, 28-32)
interface DashboardState {
  metrics: {
    totalRevenue: number;
    totalTransactions: number;
    revenueLoss: number;
    totalDiscrepancies: number;
  };
  period: 'today' | 'week' | 'month' | 'all-time';
  charts: {
    revenueByDate: ChartData[];
    transactionsByStatus: ChartData[];
  };
  loading: boolean;
}

// discrepancies slice example (Req 14-20, 27)
interface DiscrepanciesState {
  list: Discrepancy[];
  currentRecord: Discrepancy | null;
  filters: {
    status: DiscrepancyStatus[]; // pending, investigating, resolved
    routeNumber: string[];
    busNumber: string[];
    dateFrom: Date;
    dateTo: Date;
  };
  pagination: { page: number; limit: number };
  loading: boolean;
}

// reports slice example (Req 23-26)
interface ReportsState {
  templates: ReportTemplate[];
  selectedTemplate: 'daily' | 'all-time' | 'ticket-sales';
  filters: {
    dateFrom: Date;
    dateTo: Date;
    routeNumber?: string;
    busNumber?: string;
    transactionType?: string;
  };
  generatedReport: Report | null;
  exportFormat: 'csv'; // Only CSV per Req 26
  loading: boolean;
}
```

### Back Office Portal Dependencies

```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x",
  "@reduxjs/toolkit": "^1.9.x",
  "react-redux": "^8.x",
  "axios": "^1.6.x",
  "tailwindcss": "^3.x",
  "@heroicons/react": "^2.x",
  "@headlessui/react": "^1.x",
  "react-i18next": "^13.x",
  "i18next": "^23.x",
  "date-fns": "^2.x",
  "recharts": "^2.x",
  "papaparse": "^5.x",
  "@tanstack/react-table": "^8.x"
}
```

---

## BACKEND API ENDPOINTS MAPPING

### Authentication (Req 01, 02, 03, 11, 12)

```
POST /api/v1/auth/register
  Body: { email, password, fullName, phoneNumber, userType }
  Response: { userId, requiresOtpVerification }

POST /api/v1/auth/verify-otp [Req 03]
  Body: { userId, otp, phoneNumber }
  Response: { token, refreshToken }

POST /api/v1/auth/login [Req 01, 12]
  Body: { email, password }
  Response: { token, refreshToken, user }

POST /api/v1/auth/refresh-token
  Body: { refreshToken }
  Response: { token, refreshToken }

POST /api/v1/auth/logout
  Response: { success }
```

### Tickets (Req 04, 05, 06, 07)

```
POST /api/v1/tickets/purchase [Req 04, 05]
  Headers: Authorization: Bearer {token}
  Body: { routeId, fromStopId, toStopId, passengerCount, paymentMethod }
  Response: { ticketId, ticketDetails, qrCode }

GET /api/v1/tickets/:ticketId [Req 04]
  Headers: Authorization: Bearer {token}
  Response: { ticket details }

GET /api/v1/tickets/user/:userId [Req 06]
  Headers: Authorization: Bearer {token}
  Query: { page, limit, dateFrom, dateTo }
  Response: { tickets[], pagination }

POST /api/v1/tickets/:ticketId/share [Req 07]
  Headers: Authorization: Bearer {token}
  Body: { phoneNumber, deliveryMethod: "sms" | "whatsapp" }
  Response: { success, messageId }

POST /api/v1/tickets/:ticketId/validate
  Body: { qrCode | ticketId }
  Response: { valid, ticketDetails }
```

### Users/Profile (Req 08, 09)

```
GET /api/v1/users/:userId [Req 08]
  Headers: Authorization: Bearer {token}
  Response: { user profile }

PUT /api/v1/users/:userId [Req 09]
  Headers: Authorization: Bearer {token}
  Body: { fullName, phoneNumber, email, profilePhoto }
  Response: { updated user }

GET /api/v1/users/:userId/transactions [Req 06, 34]
  Headers: Authorization: Bearer {token}
  Query: { page, limit, dateFrom, dateTo }
  Response: { transactions[] }
```

### Routes (Req 21, 22)

```
POST /api/v1/routes [Req 21 - Bus owner only]
  Headers: Authorization: Bearer {token}
  Body: { routeNumber, busNumber, stops[], description }
  Response: { routeId }

GET /api/v1/routes [Req 22]
  Headers: Authorization: Bearer {token}
  Query: { page, limit, routeNumber, busNumber }
  Response: { routes[], pagination }

GET /api/v1/routes/:routeId [Req 22]
  Headers: Authorization: Bearer {token}
  Response: { route details with stops }

PUT /api/v1/routes/:routeId [Req 21]
  Headers: Authorization: Bearer {token}
  Body: { routeNumber, busNumber, stops[] }
  Response: { updated route }

DELETE /api/v1/routes/:routeId [Req 21]
  Headers: Authorization: Bearer {token}
  Response: { success }
```

### Transactions (Req 33, 31, 34)

```
GET /api/v1/transactions [Req 33, 31]
  Headers: Authorization: Bearer {token}
  Query: { page, limit, dateFrom, dateTo, status }
  Response: { transactions[], pagination }

GET /api/v1/transactions?userId={userId} [Req 34]
  Headers: Authorization: Bearer {token}
  Query: { page, limit }
  Response: { transactions[] }
```

### Discrepancies (Req 14, 15, 16, 17, 18, 19, 20, 27)

```
GET /api/v1/discrepancies [Req 14, 15]
  Headers: Authorization: Bearer {token}
  Query: { page, limit, status, routeNumber, busNumber, dateFrom, dateTo }
  Response: { discrepancies[], pagination }

GET /api/v1/discrepancies/:id [Req 16, 17]
  Headers: Authorization: Bearer {token}
  Response: {
    id, routeNumber, busNumber, date,
    expectedRevenue, actualRevenue, loss,
    status
  }

PUT /api/v1/discrepancies/:id/status [Req 18]
  Headers: Authorization: Bearer {token}
  Body: { status: "pending" | "investigating" | "resolved" }
  Response: { updated discrepancy }

GET /api/v1/discrepancies/stats [Req 14]
  Headers: Authorization: Bearer {token}
  Response: { totalDiscrepancies, byStatus, byRoute }
```

### Dashboard (Req 13, 28, 29, 30, 32)

```
GET /api/v1/dashboard/metrics [Req 13]
  Headers: Authorization: Bearer {token}
  Query: { dateFrom, dateTo }
  Response: {
    totalRevenue,
    totalTransactions,
    totalDiscrepancies,
    revenueLoss
  }

GET /api/v1/dashboard/revenue-summary [Req 28, 29]
  Headers: Authorization: Bearer {token}
  Query: { period: "today" | "week" | "month" | "all-time" }
  Response: { revenue, byDate[], byRoute[] }

GET /api/v1/dashboard/transaction-count [Req 30]
  Headers: Authorization: Bearer {token}
  Response: { count, byStatus }

GET /api/v1/dashboard/revenue-loss [Req 32]
  Headers: Authorization: Bearer {token}
  Response: { totalLoss, byRoute[] }
```

### Reports (Req 23, 24, 25, 26)

```
POST /api/v1/reports/daily [Req 23]
  Headers: Authorization: Bearer {token}
  Body: { date, routeFilter, busFilter }
  Response: { reportId, data, generatedAt }

POST /api/v1/reports/all-time [Req 24]
  Headers: Authorization: Bearer {token}
  Body: { dateFrom, dateTo, routeFilter, busFilter }
  Response: { reportId, data }

POST /api/v1/reports/ticket-sales [Req 25]
  Headers: Authorization: Bearer {token}
  Body: { dateFrom, dateTo, routeFilter }
  Response: {
    reportId,
    data: [{ticketId, date, routeId, stop, amount}]
  }

POST /api/v1/reports/:reportId/export [Req 26]
  Headers: Authorization: Bearer {token}
  Query: { format: "csv" }
  Response: CSV file download
```

### Audit Logs (Req 35)

```
GET /api/v1/audit/logs [Req 35 - Bus owner only]
  Headers: Authorization: Bearer {token}
  Query: { page, limit, userId, dateFrom, dateTo, actionType }
  Response: { logs[], pagination }
```

### Alerts (Req 36)

```
WebSocket: ws://localhost:8000/ws/notifications
  Headers: { Authorization: Bearer {token} }
  Receives: { type, message, discrepancyId, severity }

POST /api/v1/discrepancies/:id/alert [Req 36]
  Headers: Authorization: Bearer {token}
  Body: { alertMessage }
  Response: { alertId, sent }
```

### Scheduled Jobs (Req 37)

```
Cron Job: Daily at 12:00 AM
- Query all discrepancies created in last 24h
- Generate summary with expected vs actual revenue
- Send email to bus owners via Supabase SMTP
```

---

## SECURITY & AUTHENTICATION

### JWT Implementation
- Supabase Auth handles token generation
- Tokens stored in secure storage (localStorage for web, secure storage for mobile)
- Refresh token rotation on each refresh
- Token expiration: 1 hour (access), 7 days (refresh)

### Role-Based Access Control (RBAC)
```
Roles:
- rider: Can purchase tickets, view own transactions, edit own profile
- bus_owner: Can manage routes, view audit logs, receive alerts
- accountant: Can view discrepancies, reports, all transactions
- admin: Full access
```

### Input Validation
- Email format validation
- Password strength: min 8 chars, 1 uppercase, 1 number, 1 special char
- Phone number format validation
- OTP length: 6 digits
- Rate limiting on OTP requests (max 3 per 15 min)

### Data Protection
- All sensitive data encrypted in transit (HTTPS)
- Password hashing: bcrypt (Supabase handles)
- PII not logged in audit logs
- GDPR compliance for data deletion

---

## TECHNOLOGY STACK DETAILS

| Component | Technology | Version | Notes |
|-----------|-----------|---------|-------|
| Frontend Build | Vite | ^5.0 | Fast HMR, optimized build |
| UI Framework | React | ^18.0 | Hooks-based |
| Language | TypeScript | ^5.0 | Strict mode |
| Routing | React Router | ^6.0 | Client-side routing |
| State | Redux + RTK | ^1.9 | Normalized state |
| HTTP | Axios | ^1.6 | Promise-based, interceptors |
| Styling | Tailwind CSS | ^3.0 | Utility-first CSS |
| Icons | Heroicons | ^2.0 | SVG icons with React |
| Backend | Go Fiber | ^2.50 | Fast, lightweight framework |
| Database | PostgreSQL (Supabase) | - | ACID, relational data |
| NoSQL | MongoDB | ^6.0 | Document storage for logs |
| Auth | Supabase Auth | - | JWT, SMS OTP, Email |
| SMTP | Supabase SMTP | - | Email delivery |
| SMS | Twilio/AWS SNS | - | SMS/WhatsApp OTP |
| Deployment | Docker | - | Containerization |

---

## DATABASE SCHEMA (PostgreSQL + MongoDB)

### PostgreSQL Tables (PRIMARY OPERATIONAL DATA)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  full_name VARCHAR(255),
  role ENUM('rider', 'bus_owner', 'accountant', 'admin') DEFAULT 'rider',
  password_hash VARCHAR(255),
  profile_photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- Routes (Req 21, 22)
CREATE TABLE routes (
  id UUID PRIMARY KEY,
  route_number VARCHAR(50) NOT NULL,
  bus_number VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES users(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stops
CREATE TABLE stops (
  id UUID PRIMARY KEY,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  stop_name VARCHAR(255) NOT NULL,
  sequence_order INTEGER NOT NULL,
  coordinates POINT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tickets (Req 04, 06, 07)
CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  route_id UUID REFERENCES routes(id),
  from_stop_id UUID REFERENCES stops(id),
  to_stop_id UUID REFERENCES stops(id),
  purchase_date TIMESTAMP DEFAULT NOW(),
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('active', 'used', 'cancelled') DEFAULT 'active',
  qr_code_hash VARCHAR(255),
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions (Req 06, 33, 31, 34)
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  ticket_id UUID REFERENCES tickets(id),
  amount DECIMAL(10, 2) NOT NULL,
  transaction_date TIMESTAMP DEFAULT NOW(),
  payment_method VARCHAR(50),
  status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
  currency VARCHAR(3) DEFAULT 'LKR',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Discrepancies (Req 14, 15, 16, 17, 18, 19, 20, 27)
CREATE TABLE discrepancies (
  id UUID PRIMARY KEY,
  route_id UUID REFERENCES routes(id),
  bus_number VARCHAR(50),
  transaction_date DATE,
  expected_revenue DECIMAL(10, 2),
  actual_revenue DECIMAL(10, 2),
  loss_amount DECIMAL(10, 2),  -- calculated as expected - actual
  status ENUM('pending', 'investigating', 'resolved') DEFAULT 'pending',
  updated_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reports (Req 23, 24, 25, 26)
CREATE TABLE reports (
  id UUID PRIMARY KEY,
  report_type ENUM('daily', 'all_time', 'ticket_sales'),
  date_from DATE,
  date_to DATE,
  data JSONB,
  created_by UUID REFERENCES users(id),
  export_format VARCHAR(10) DEFAULT 'csv',
  file_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alert Settings (Req 36, 37)
CREATE TABLE alert_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  alert_type ENUM('email', 'sms', 'in_app'),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### MongoDB Collections (DOCUMENT STORAGE)

```javascript
// Audit Logs (Req 35)
db.audit_logs.insertOne({
  _id: ObjectId(),
  user_id: UUID,
  action: "status_update" | "route_created" | "report_generated",
  resource: "discrepancy" | "route" | "report",
  resource_id: UUID,
  old_value: {...},
  new_value: {...},
  ip_address: "192.168.1.1",
  user_agent: "...",
  timestamp: ISODate(),
  details: {...}
});

// Notification Logs (Req 03, 07, 36, 37)
db.notification_logs.insertOne({
  _id: ObjectId(),
  user_id: UUID,
  notification_type: "otp" | "ticket_share" | "alert" | "daily_summary",
  recipient: "+94712345678" | "email@example.com",
  channel: "sms" | "email" | "whatsapp",
  content: "...",
  status: "sent" | "failed" | "pending",
  sent_at: ISODate(),
  delivery_timestamp: ISODate(),
  error_message: null | "..."
});

// Transaction Logs (Req 33)
db.transaction_logs.insertOne({
  _id: ObjectId(),
  transaction_id: UUID,
  user_id: UUID,
  ticket_id: UUID,
  amount: 500,
  currency: "LKR",
  payment_method: "card" | "mobile_money",
  status: "completed",
  metadata: {
    device_type: "mobile" | "web",
    ip_address: "...",
    timestamp_ms: 1234567890
  },
  created_at: ISODate()
});
```

---

## IMPLEMENTATION TIMELINE (16 WEEKS)

**Phase 1 (Week 1-2): Foundation**
- [ ] Backend: Go Fiber project setup, database connections
- [ ] Database: Create PostgreSQL & MongoDB schemas
- [ ] Frontend: Vite projects setup, Redux store structure
- [ ] Deliverable: Boilerplate code committed, development environment ready

**Phase 2 (Week 3-4): Authentication & Core APIs**
- [ ] Backend: Auth endpoints (Req 01, 02, 03, 11, 12)
- [ ] Backend: OTP generation & SMS integration
- [ ] Frontend: Login/Register pages (both apps)
- [ ] Frontend: Redux auth slice & interceptors
- [ ] Deliverable: Users can register, verify OTP, and login

**Phase 3 (Week 5-6): Mobile App - Tickets & Profile**
- [ ] Backend: Ticket purchase & validation APIs (Req 04, 05)
- [ ] Backend: User profile endpoints (Req 08, 09)
- [ ] Frontend (Mobile): Ticket purchase wizard (Req 04, 05)
- [ ] Frontend (Mobile): Profile management (Req 08, 09)
- [ ] Frontend (Mobile): Transaction history (Req 06)
- [ ] Frontend (Mobile): Multi-language support (Req 10)
- [ ] Deliverable: Mobile app fully functional for riders

**Phase 4 (Week 7-8): Back Office - Dashboard**
- [ ] Backend: Dashboard metrics endpoints (Req 13, 28, 29, 30, 32)
- [ ] Backend: Transaction APIs (Req 31, 33, 34)
- [ ] Frontend (Portal): Dashboard with KPI cards
- [ ] Frontend (Portal): Revenue & transaction charts
- [ ] Frontend (Portal): Role-based access control
- [ ] Deliverable: Managers can view real-time dashboard

**Phase 5 (Week 9-10): Discrepancies & Revenue Reconciliation**
- [ ] Backend: Discrepancy calculation & filtering (Req 14-20, 27)
- [ ] Backend: Status workflow API (Req 18)
- [ ] Frontend (Portal): Discrepancy management page
- [ ] Frontend (Portal): Revenue reconciliation view
- [ ] Frontend (Portal): Bulk operations
- [ ] Deliverable: Accountants can track & resolve discrepancies

**Phase 6 (Week 11-12): Reports & Alerts**
- [ ] Backend: Report generation engines (Req 23, 24, 25, 26)
- [ ] Backend: CSV export utilities (Req 26)
- [ ] Backend: Alert system & email jobs (Req 36, 37)
- [ ] Backend: Audit logs (Req 35)
- [ ] Frontend (Portal): Report builder
- [ ] Frontend (Portal): Audit logs viewer
- [ ] Frontend (Portal): Notification center
- [ ] Deliverable: All reports & alerts functional

**Phase 7 (Week 13-14): Routes Management & Testing**
- [ ] Backend: Route CRUD APIs (Req 21, 22)
- [ ] Frontend (Portal): Route management interface
- [ ] Unit tests (backend)
- [ ] Integration tests
- [ ] E2E tests (key flows)
- [ ] Performance optimization
- [ ] Deliverable: 80%+ code coverage

**Phase 8 (Week 15-16): Deployment & Documentation**
- [ ] Docker setup for backend & databases
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Docker Compose for local development
- [ ] API documentation (Swagger)
- [ ] User documentation
- [ ] Deployment to staging
- [ ] Deliverable: System ready for UAT & production

---

## ACCEPTANCE CRITERIA

Mobile App (Req 01-10):
- ✅ User can register with OTP verification
- ✅ User can login securely
- ✅ User can purchase tickets with validation
- ✅ Transaction history is viewable
- ✅ Profile can be viewed & edited
- ✅ Ticket can be shared via SMS/WhatsApp
- ✅ UI supports Tamil, English, Sinhala
- ✅ Works on mobile & tablet screens

Back Office Portal (Req 11-37):
- ✅ Dashboard shows real-time KPIs (revenue, transactions, loss)
- ✅ Discrepancies can be filtered & status updated
- ✅ Reports can be generated (daily, all-time, ticket sales)
- ✅ Reports export as CSV only
- ✅ Routes can be created & managed
- ✅ Audit logs track all activities
- ✅ Alerts notify bus owners of discrepancies
- ✅ Daily email at 12 AM with summary
- ✅ Role-based access enforced
- ✅ Multi-language support
- ✅ UI responsive on desktop & tablets

Backend:
- ✅ All endpoints match API spec
- ✅ JWT authentication on protected routes
- ✅ Input validation on all endpoints
- ✅ Error handling with proper HTTP codes
- ✅ Database transactions for financial operations
- ✅ Audit trail for sensitive operations
- ✅ Rate limiting on sensitive endpoints
- ✅ 99.5% uptime commitment
