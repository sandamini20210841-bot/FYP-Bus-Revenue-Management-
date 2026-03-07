# Bus Ticketing & Revenue Reconciliation System

This project has 3 parts:

1. `backend/` (API server)
2. `mobile-app/` (user app, opens on port `3000`)
3. `back-office-portal/` (admin app, opens on port `3001`)

This guide is written for someone with little or no technical background.

## Before You Start

Install these tools first:

1. `Docker Desktop`
2. `Node.js` (LTS version)
3. `Go` (1.21 or newer)
4. `Git` (optional, but recommended)

After installing Docker Desktop, open it and make sure it says it is running.

## Quick Start (Windows, Step-by-Step)

Open PowerShell in the project root folder (`FYP code/FYP code`) and follow exactly.

If you are using VS Code:

1. Open VS Code.
2. Click `File` -> `Open Folder...`.
3. Select the project root folder (the folder that contains `backend`, `mobile-app`, `back-office-portal`, and `docker-compose.yml`).
4. In the top menu, click `Terminal` -> `New Terminal`.

VS Code terminals usually open in the selected folder automatically.

To confirm, run:

```powershell
Get-ChildItem
```

You should see folder names like `backend`, `mobile-app`, and `back-office-portal`.

If you do not see them, run `cd` to move into the correct folder path on that device, then continue.

### Step 1: Start databases with Docker

```powershell
docker compose up -d postgres mongodb
```

What this does:

- Starts PostgreSQL on port `5432`
- Starts MongoDB on port `27017`

### Step 2: Start backend API

Open a new PowerShell window:

```powershell
cd backend
go run main.go
```

If successful, backend runs on `http://localhost:8000`.

Test it quickly in browser: `http://localhost:8000/health`

You should see JSON with `"status": "ok"`.

### Step 3: Start mobile app (user app)

Open another new PowerShell window:

```powershell
cd mobile-app
npm install
npm run dev
```

Open: `http://localhost:3000`

### Step 4: Start back-office portal (admin app)

Open another new PowerShell window:

```powershell
cd back-office-portal
npm install
npm run dev
```

Open: `http://localhost:3001`

## Environment Variables (Backend)

Backend environment file is at `backend/.env`.

Important values already set for local use:

```env
PORT=8000
POSTGRES_URL=postgres://busticket:busticket_password@localhost:5432/busticket?sslmode=disable
MONGO_URL=mongodb://localhost:27017
MONGO_DB_NAME=busticket
```

If you changed Docker database usernames/passwords, update `POSTGRES_URL` too.

## Stop Everything

1. In each PowerShell window running `go run` or `npm run dev`, press `Ctrl + C`.
2. Stop databases:

```powershell
docker compose down
```

## Common Problems and Fixes

### `docker` command not found

Docker Desktop is not installed or not running. Install/start Docker Desktop, then retry.

### Backend fails to connect to PostgreSQL

Check:

1. Docker containers are running: `docker compose ps`
2. `POSTGRES_URL` in `backend/.env` matches `docker-compose.yml`

### `go run main.go` fails with module download errors

In `backend` folder run:

```powershell
$env:GOPROXY="direct"
$env:GONOSUMCHECK="*"
$env:GONOSUMDB="*"
go mod tidy
go run main.go
```

### Frontend says `npm` command not found

Node.js is missing. Install Node.js LTS, close terminal, open a new one, and retry.

## Project Structure

```
backend/              Go Fiber API
mobile-app/           React app (port 3000)
back-office-portal/   React admin app (port 3001)
scripts/              Database initialization SQL
docs/                 Extra documentation
```

## Extra Documentation

For full project details, see:

- `REQUIREMENTS_MAPPING.md`
- `PROJECT_PLAN.md`
"# FYP-Bus-Revenue-Management-" 
"# FYP-Bus-Revenue-Management-" 
