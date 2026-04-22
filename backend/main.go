package main

import (
	"database/sql"
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

	// Timetable management
	timetables := protected.Group("/timetables")
	timetables.Get("/setup", handlers.GetTimetableSetup)
	timetables.Post("/setup", handlers.UpsertTimetableSetup)
	timetables.Get("/calendar", handlers.GetTimetableCalendar)
	timetables.Get("/entries", handlers.GetTimetableEntries)
	timetables.Post("/entries", handlers.UpsertTimetableEntry)
	timetables.Delete("/entries", handlers.DeleteTimetableEntry)
	timetables.Delete("/date", handlers.DeleteTimetableDate)

	// Transactions
	transactions := protected.Group("/transactions")
	transactions.Get("", handlers.GetTransactions)

	// Discrepancies
	discrepancies := protected.Group("/discrepancies")
	discrepancies.Post("/analyze", handlers.AnalyzeDiscrepancies)
	discrepancies.Get("", handlers.GetDiscrepancies)
	discrepancies.Get("/stats", handlers.GetDiscrepancyStats)
	discrepancies.Get("/:id", handlers.GetDiscrepancy)
	discrepancies.Put("/:id/status", handlers.UpdateDiscrepancyStatus)

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
	reports.Post("/export-transactions-csv", handlers.ExportTransactionsCSV)

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

	// Start background scheduled discrepancy analysis every 30 minutes (full system analysis).
	// Per-departure analysis (10 minutes after each bus departs) is handled by the job worker below.
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			log.Println("Running scheduled full-system discrepancy analysis")
			if err := handlers.RunDiscrepancyAnalysisNow(30); err != nil {
				log.Printf("Scheduled discrepancy analysis failed: %v", err)
			}
		}
	}()

	// Start DB-backed job worker to process per-departure analysis jobs every minute.
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			log.Println("[JOB_WORKER] Tick: checking for pending discrepancy jobs...")

			var pendingJobs int
			if err := database.QueryRow(`SELECT COUNT(*) FROM discrepancy_jobs WHERE status = 'pending'`).Scan(&pendingJobs); err != nil {
				log.Printf("[JOB_WORKER] ERROR checking pending job count: %v", err)
				continue
			}

			var dueJobs int
			if err := database.QueryRow(`SELECT COUNT(*) FROM discrepancy_jobs WHERE status = 'pending' AND scheduled_at <= NOW()`).Scan(&dueJobs); err != nil {
				log.Printf("[JOB_WORKER] ERROR checking due job count: %v", err)
				continue
			}

			if pendingJobs == 0 {
				log.Println("[JOB_WORKER] Queue is empty: no pending discrepancy jobs exist")
			} else {
				var nextScheduled sql.NullTime
				if err := database.QueryRow(`SELECT MIN(scheduled_at) FROM discrepancy_jobs WHERE status = 'pending'`).Scan(&nextScheduled); err == nil && nextScheduled.Valid {
					log.Printf("[JOB_WORKER] Queue status: pending=%d due_now=%d next_due=%s", pendingJobs, dueJobs, nextScheduled.Time.Format("2006-01-02 15:04:05 MST"))
				} else {
					log.Printf("[JOB_WORKER] Queue status: pending=%d due_now=%d next_due=<unknown>", pendingJobs, dueJobs)
				}
			}

			// Claim a small batch of pending jobs and mark them processing
			rows, err := database.Query(`UPDATE discrepancy_jobs SET status='processing', updated_at=NOW()
			WHERE id IN (
				SELECT id FROM discrepancy_jobs
				WHERE status='pending' AND scheduled_at <= NOW()
				ORDER BY scheduled_at ASC
				FOR UPDATE SKIP LOCKED
				LIMIT 5
			)
			RETURNING id, route_id::text, bus_number, service_date, attempts`)
			if err != nil {
				log.Printf("[JOB_WORKER] ERROR claiming jobs: %v", err)
				continue
			}

			jobCount := 0
			for rows.Next() {
				jobCount++
				var id string
				var routeID sql.NullString
				var busNumber string
				var serviceDate time.Time
				var attempts int
				if scanErr := rows.Scan(&id, &routeID, &busNumber, &serviceDate, &attempts); scanErr != nil {
					log.Printf("[JOB_WORKER] ERROR scanning job row: %v", scanErr)
					continue
				}
				routeStr := ""
				if routeID.Valid {
					routeStr = routeID.String
				}

				log.Printf("[JOB_WORKER] Processing job #%d: id=%s, bus=%s, date=%s, route=%s, attempt=%d",
					jobCount, id, busNumber, serviceDate.Format("2006-01-02"), routeStr, attempts+1)

				// Run targeted analysis for this job
				if runErr := handlers.RunDiscrepancyForBusDate(routeStr, busNumber, serviceDate.Format("2006-01-02")); runErr != nil {
					log.Printf("[JOB_WORKER] ❌ Job %s FAILED (attempt %d): %v", id, attempts+1, runErr)
					// retry with exponential-ish backoff up to 3 attempts
					if attempts < 3 {
						backoff := 5 * (attempts + 1) // minutes
						log.Printf("[JOB_WORKER] Retrying job %s in %d minutes (attempt %d/3)", id, backoff, attempts+2)
						_, _ = database.Exec(`UPDATE discrepancy_jobs SET status='pending', attempts = attempts + 1, scheduled_at = NOW() + ($1 || ' minutes')::interval, last_error = $2, updated_at = NOW() WHERE id = $3`, fmt.Sprint(backoff), runErr.Error(), id)
					} else {
						log.Printf("[JOB_WORKER] ⚠️  Job %s EXHAUSTED (max 3 attempts reached)", id)
						_, _ = database.Exec(`UPDATE discrepancy_jobs SET status='failed', attempts = attempts + 1, last_error = $1, updated_at = NOW() WHERE id = $2`, runErr.Error(), id)
					}
				} else {
					log.Printf("[JOB_WORKER] ✅ Job %s SUCCEEDED", id)
					_, _ = database.Exec(`UPDATE discrepancy_jobs SET status='done', attempts = attempts + 1, updated_at = NOW() WHERE id = $1`, id)
				}
			}
			rows.Close()

			if jobCount == 0 {
				log.Println("[JOB_WORKER] No pending jobs found (all on schedule)")
			} else {
				log.Printf("[JOB_WORKER] Processed %d job(s)", jobCount)
			}
		}
	}()

	log.Printf("🚀 Server starting on port %s", port)
	if err := app.Listen(fmt.Sprintf(":%s", port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
