package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/busticket/backend/config"
	"github.com/busticket/backend/database"
	"github.com/busticket/backend/handlers"
	"github.com/busticket/backend/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.LoadConfig()

	// Initialize PostgreSQL connection (MongoDB is not required for this setup)
	if err := database.InitPostgres(cfg); err != nil {
		log.Fatalf("Failed to initialize PostgreSQL: %v", err)
	}
	defer database.ClosePostgres()

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Bus Ticketing System API",
		Prefork: cfg.Prefork,
	})

	// Middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CORSOrigins,
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Content-Type,Authorization",
	}))
	app.Use(middleware.Logger())
	app.Use(middleware.ErrorHandler())

	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"timestamp": time.Now().Unix(),
		})
	})

	// API v1 routes
	api := app.Group("/api/v1")

	// Auth routes
	auth := api.Group("/auth")
	auth.Post("/register", handlers.Register)
	auth.Post("/verify-otp", handlers.VerifyOTP)
	auth.Post("/login", handlers.Login)
	auth.Post("/refresh-token", handlers.RefreshToken)
	auth.Post("/logout", middleware.AuthRequired(), handlers.Logout)
	auth.Post("/forgot-password", handlers.ForgotPassword)
	auth.Post("/reset-password", handlers.ResetPassword)

	// Public ticket validation route for QR camera scans
	ticketsPublic := api.Group("/tickets/public")
	ticketsPublic.Get("/validate", handlers.PublicValidateTicket)

	// Protected routes
	protected := api.Group("")
	protected.Use(middleware.AuthRequired())
	protected.Use(middleware.AuditLog())

	// Tickets routes
	tickets := protected.Group("/tickets")
	tickets.Post("/purchase", handlers.PurchaseTicket)
	tickets.Get("/:ticketId", handlers.GetTicket)
	tickets.Get("/user/:userId", handlers.GetUserTickets)
	tickets.Post("/:ticketId/share", handlers.ShareTicket)
	tickets.Post("/validate", handlers.ValidateTicket)

	// Users routes
	users := protected.Group("/users")
	users.Post("", handlers.CreateUser)
	users.Get("", handlers.GetUsers)
	users.Get("/me/access", handlers.GetMyAccess)
	users.Get("/:userId/access", handlers.GetUserAccess)
	users.Put("/:userId/access", handlers.UpdateUserAccess)
	users.Delete("/:userId", handlers.DeleteUser)
	users.Get("/:userId", handlers.GetUser)
	users.Put("/:userId", handlers.UpdateUser)
	users.Get("/:userId/transactions", handlers.GetUserTransactions)
	users.Post("/me/change-password", handlers.ChangePassword)

	// Routes management
	routes := protected.Group("/routes")
	routes.Post("", handlers.CreateRoute)
	routes.Get("", handlers.GetRoutes)
	routes.Get("/:routeId", handlers.GetRoute)
	routes.Put("/:routeId", handlers.UpdateRoute)
	routes.Delete("/:routeId", handlers.DeleteRoute)

	// Buses management
	buses := protected.Group("/buses")
	buses.Post("", handlers.CreateBus)
	buses.Get("", handlers.GetBuses)
	buses.Put("/:busId", handlers.UpdateBus)
	buses.Delete("/:busId", handlers.DeleteBus)

	// Route departures
	departures := protected.Group("/departures")
	departures.Get("", handlers.GetRouteDepartures)

	// Transactions
	transactions := protected.Group("/transactions")
	transactions.Get("", handlers.GetTransactions)

	// Discrepancies
	discrepancies := protected.Group("/discrepancies")
	discrepancies.Get("", handlers.GetDiscrepancies)
	discrepancies.Get("/:id", handlers.GetDiscrepancy)
	discrepancies.Put("/:id/status", handlers.UpdateDiscrepancyStatus)
	discrepancies.Get("/stats", handlers.GetDiscrepancyStats)

	// Dashboard
	dashboard := protected.Group("/dashboard")
	dashboard.Get("/metrics", handlers.GetDashboardMetrics)
	dashboard.Get("/revenue-summary", handlers.GetRevenueSummary)
	dashboard.Get("/transaction-count", handlers.GetTransactionCount)
	dashboard.Get("/revenue-loss", handlers.GetRevenueLoss)

	// Reports
	reports := protected.Group("/reports")
	reports.Post("/daily", handlers.GenerateDailyReport)
	reports.Post("/all-time", handlers.GenerateAllTimeReport)
	reports.Post("/ticket-sales", handlers.GenerateTicketSalesReport)
	reports.Post("/:reportId/export", handlers.ExportReport)

	// Audit logs
	audit := protected.Group("/audit")
	audit.Get("/logs", handlers.GetAuditLogs)

	// Alerts
	protected.Post("/discrepancies/:id/alert", handlers.TriggerAlert)

	// 404 handler
	app.Use(func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Route not found",
		})
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("🚀 Server starting on port %s", port)
	if err := app.Listen(fmt.Sprintf(":%s", port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
