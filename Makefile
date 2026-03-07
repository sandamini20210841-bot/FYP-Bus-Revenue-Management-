.PHONY: help install dev dev-backend dev-mobile dev-portal docker-up docker-down docker-logs db-populate clean build

help:
	@echo "Bus Ticketing & Revenue Reconciliation System"
	@echo "=============================================="
	@echo ""
	@echo "Available commands:"
	@echo ""
	@echo "  make install          - Install all dependencies"
	@echo "  make dev              - Start all services (backend + frontends)"
	@echo "  make dev-backend      - Start backend only"
	@echo "  make dev-mobile       - Start mobile app only"
	@echo "  make dev-portal       - Start back-office portal only"
	@echo ""
	@echo "  make docker-up        - Start Docker containers (PostgreSQL, MongoDB, Backend)"
	@echo "  make docker-down      - Stop Docker containers"
	@echo "  make docker-logs      - View Docker logs"
	@echo "  make docker-clean     - Remove Docker volumes"
	@echo ""
	@echo "  make db-populate      - Populate database with sample data"
	@echo "  make db-reset         - Reset database schema"
	@echo ""
	@echo "  make build            - Build all projects (backend + frontends)"
	@echo "  make build-backend    - Build backend only"
	@echo "  make build-mobile     - Build mobile app only"
	@echo "  make build-portal     - Build back-office portal only"
	@echo ""
	@echo "  make clean            - Clean all build artifacts"
	@echo "  make lint-backend     - Lint backend code"
	@echo "  make test-backend     - Run backend tests"
	@echo ""
	@echo "  make setup            - Initial project setup"

# Installation targets
install: install-backend install-frontend-deps
	@echo "✅ All dependencies installed"

install-backend:
	@echo "Installing backend dependencies..."
	cd backend && go mod download && go mod tidy

install-frontend-deps:
	@echo "Installing mobile app dependencies..."
	cd mobile-app && npm install
	@echo "Installing back-office portal dependencies..."
	cd back-office-portal && npm install
	@echo "✅ Frontend dependencies installed"

# Development targets
dev:
	@echo "Starting all services..."
	@echo "Press Ctrl+C to stop"
	@mkdir -p .dev-pids
	@bash -c 'make docker-up & make dev-backend & make dev-mobile & make dev-portal & wait'

dev-backend:
	@echo "Starting backend on port 8000..."
	cd backend && go run main.go

dev-mobile:
	@echo "Starting mobile app on port 3000..."
	@sleep 2
	cd mobile-app && npm run dev

dev-portal:
	@echo "Starting back-office portal on port 3001..."
	@sleep 3
	cd back-office-portal && npm run dev

# Docker targets
docker-up:
	@echo "Starting Docker containers..."
	docker-compose up -d
	@echo "✅ Services started:"
	@echo "  PostgreSQL:  localhost:5432 (busticket / busticket_password)"
	@echo "  MongoDB:     localhost:27017 (admin / admin_password)"
	@echo "  Backend API: http://localhost:8000"
	@echo ""
	@echo "Check status: make docker-logs"

docker-down:
	@echo "Stopping Docker containers..."
	docker-compose down
	@echo "✅ Services stopped"

docker-logs:
	docker-compose logs -f

docker-clean:
	@echo "Removing Docker volumes..."
	docker-compose down -v
	@echo "✅ Volumes removed"

# Database targets
db-populate:
	@echo "Populating database with sample data..."
	@echo "TODO: Implement sample data script"

db-reset:
	@echo "Resetting database..."
	docker-compose restart postgres
	@echo "✅ Database reset"

# Build targets
build: build-backend build-mobile build-portal
	@echo "✅ All projects built successfully"

build-backend:
	@echo "Building backend..."
	cd backend && CGO_ENABLED=1 GOOS=linux go build -o bin/busticket-api .
	@echo "✅ Backend built: backend/bin/busticket-api"

build-mobile:
	@echo "Building mobile app..."
	cd mobile-app && npm run build
	@echo "✅ Mobile app built: mobile-app/dist/"

build-portal:
	@echo "Building back-office portal..."
	cd back-office-portal && npm run build
	@echo "✅ Portal built: back-office-portal/dist/"

# Code quality targets
lint-backend:
	@echo "Linting backend code..."
	cd backend && go fmt ./...
	@echo "✅ Backend formatted"

test-backend:
	@echo "Running backend tests..."
	cd backend && go test ./...

# Cleanup targets
clean:
	@echo "Cleaning build artifacts..."
	rm -rf backend/bin/*
	rm -rf mobile-app/dist/*
	rm -rf back-office-portal/dist/*
	rm -rf mobile-app/node_modules
	rm -rf back-office-portal/node_modules
	@echo "✅ Cleaned"

# Setup target
setup: install docker-up
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Start development: make dev"
	@echo "  2. Backend: http://localhost:8000"
	@echo "  3. Mobile app: http://localhost:3000"
	@echo "  4. Portal: http://localhost:3001"
	@echo ""
	@echo "For more info: make help"
