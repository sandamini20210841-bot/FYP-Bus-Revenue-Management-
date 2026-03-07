# Development Environment Setup

## Prerequisites

- Node.js 18+
- Go 1.21+
- Docker & Docker Compose
- Git

## Quick Start with Docker Compose

```bash
# Clone the repository
git clone <repo-url>
cd FYP\ code

# Start all services (PostgreSQL, MongoDB, Backend)
docker-compose up -d

# Check if services are running
docker-compose ps

# View logs
docker-compose logs -f backend
```

### Services

- **PostgreSQL**: localhost:5432
  - User: `busticket`
  - Password: `busticket_password`
  - Database: `busticket`

- **MongoDB**: localhost:27017
  - User: `admin`
  - Password: `admin_password`
  - Database: `busticket`

- **Backend API**: http://localhost:8000
  - Health check: http://localhost:8000/health

## Backend Setup (Local Development)

### 1. Install Go Dependencies

```bash
cd backend
go mod download
go mod tidy
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your local settings:

```env
PORT=8000
PREFORK=false
ENVIRONMENT=development
POSTGRES_URL=postgres://busticket:busticket_password@localhost:5432/busticket
MONGO_URL=mongodb://admin:admin_password@localhost:27017
MONGO_DB_NAME=busticket
JWT_SECRET=dev-secret-key-change-in-production
```

### 3. Run Backend

```bash
go run main.go
```

Output should show:
```
✅ PostgreSQL connected successfully
✅ MongoDB connected successfully
🚀 Server starting on port 8000
```

## Frontend Setup

### Mobile App

```bash
cd mobile-app
npm install
npm run dev
```

Visit: http://localhost:3000

### Back-Office Portal

```bash
cd back-office-portal
npm install
npm run dev
```

Visit: http://localhost:3001

## Environment Variables

### Backend (.env)

```env
# Server
PORT=8000
PREFORK=false
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Database
POSTGRES_URL=postgres://busticket:busticket_password@localhost:5432/busticket
MONGO_URL=mongodb://admin:admin_password@localhost:27017
MONGO_DB_NAME=busticket

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRATION=3600
REFRESH_EXPIRATION=604800

# Supabase (optional for local dev)
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SECRET=

# Twilio SMS (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
OTP_EXPIRATION=900

# SMTP Email (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_EMAIL=
SMTP_PASSWORD=

# Logging
LOG_LEVEL=info
```

### Mobile App (.env)

Create `.env.local` in `mobile-app/`:

```
VITE_API_URL=http://localhost:8000/api/v1
```

### Back-Office Portal (.env)

Create `.env.local` in `back-office-portal/`:

```
VITE_API_URL=http://localhost:8000/api/v1
```

## Database Setup

### PostgreSQL

The database schema is automatically created when Docker Compose starts. To manually create tables:

```bash
psql -h localhost -U busticket -d busticket < scripts/init-db.sql
```

### MongoDB

Collections are created automatically on first use.

## API Testing

### Health Check

```bash
curl http://localhost:8000/health
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# For other ports (3000, 3001, 5432, 27017)
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U busticket -d busticket -c "SELECT 1;"

# Test MongoDB connection
mongosh mongodb://admin:admin_password@localhost:27017
```

### Clear Docker Volumes

```bash
docker-compose down -v
docker-compose up -d
```

## Development Workflow

1. **Backend Changes**: Code changes auto-reload with Go (run `go run main.go`)
2. **Frontend Changes**: Auto-reload with Vite
3. **Database Changes**: Edit SQL in `scripts/init-db.sql` and restart PostgreSQL
4. **Environment Changes**: Update `.env` and restart services

## Building for Production

### Backend

```bash
cd backend
CGO_ENABLED=1 GOOS=linux go build -o bin/busticket-api .
```

### Mobile App

```bash
cd mobile-app
npm run build
```

Output: `mobile-app/dist/`

### Back-Office Portal

```bash
cd back-office-portal
npm run build
```

Output: `back-office-portal/dist/`

## Deployment

See `docs/DEPLOYMENT.md` for production deployment instructions.
