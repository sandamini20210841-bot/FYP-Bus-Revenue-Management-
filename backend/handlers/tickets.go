package handlers

import (
	"errors"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"
	"time"

	"crypto/rand"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
	"github.com/lib/pq"
)

// PurchaseTicket creates a new ticket purchase
func PurchaseTicket(c *fiber.Ctx) error {
	type PurchaseTicketRequest struct {
		RouteID        string `json:"route_id"`
		RouteNumber    string `json:"route_number"`
		FromStopID     string `json:"from_stop_id"`
		FromStopName   string `json:"from_stop_name"`
		ToStopID       string `json:"to_stop_id"`
		ToStopName     string `json:"to_stop_name"`
		Amount         string `json:"amount"`
		PassengerCount int    `json:"passenger_count"`
		PaymentMethod  string `json:"payment_method"`
	}

	type stopResolved struct {
		id       string
		name     string
		amount   sql.NullFloat64
		sequence int
	}

	var req PurchaseTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	userID, _ := c.Locals("userId").(string)
	if strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	if req.PassengerCount < 1 {
		req.PassengerCount = 1
	}
	if strings.TrimSpace(req.PaymentMethod) == "" {
		req.PaymentMethod = "cash"
	}

	var routeID string
	var routeNumber string
	if strings.TrimSpace(req.RouteID) != "" {
		err := database.QueryRow(
			`SELECT id, route_number FROM routes WHERE id = $1`,
			strings.TrimSpace(req.RouteID),
		).Scan(&routeID, &routeNumber)
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid route_id",
			})
		}
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to resolve route",
			})
		}
	} else if strings.TrimSpace(req.RouteNumber) != "" {
		err := database.QueryRow(
			`SELECT id, route_number FROM routes WHERE route_number = $1 ORDER BY created_at DESC LIMIT 1`,
			strings.TrimSpace(req.RouteNumber),
		).Scan(&routeID, &routeNumber)
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid route_number",
			})
		}
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to resolve route",
			})
		}
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "route_id or route_number is required",
		})
	}

	resolveStop := func(stopID string, stopName string) (stopResolved, error) {
		var out stopResolved
		if strings.TrimSpace(stopID) != "" {
			err := database.QueryRow(
				`SELECT id, stop_name, amount, sequence_order FROM stops WHERE id = $1 AND route_id = $2`,
				strings.TrimSpace(stopID),
				routeID,
			).Scan(&out.id, &out.name, &out.amount, &out.sequence)
			return out, err
		}

		err := database.QueryRow(
			`SELECT id, stop_name, amount, sequence_order
			 FROM stops
			 WHERE route_id = $1 AND LOWER(stop_name) = LOWER($2)
			 ORDER BY sequence_order ASC
			 LIMIT 1`,
			routeID,
			strings.TrimSpace(stopName),
		).Scan(&out.id, &out.name, &out.amount, &out.sequence)
		return out, err
	}

	fromStop, err := resolveStop(req.FromStopID, req.FromStopName)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid from stop",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to resolve from stop",
		})
	}

	toStop, err := resolveStop(req.ToStopID, req.ToStopName)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid to stop",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to resolve to stop",
		})
	}

	if fromStop.id == toStop.id {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "From and to stops must be different",
		})
	}

	ticketAmount := 0.0
	if fromStop.amount.Valid && toStop.amount.Valid {
		ticketAmount = math.Abs(toStop.amount.Float64-fromStop.amount.Float64) * float64(req.PassengerCount)
	}
	if ticketAmount <= 0 && strings.TrimSpace(req.Amount) != "" {
		parsed, parseErr := strconv.ParseFloat(strings.TrimSpace(req.Amount), 64)
		if parseErr == nil && parsed > 0 {
			ticketAmount = parsed
		}
	}
	if ticketAmount <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Unable to calculate ticket amount for selected stops",
		})
	}

	qrHash, err := generateTicketQRCodeHash()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate ticket QR code",
		})
	}

	tx, err := database.PostgresDB.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to start purchase transaction",
		})
	}
	defer tx.Rollback()

	var ticketNumber string
	var purchaseDate time.Time
	for attempt := 0; attempt < 12; attempt++ {
		ticketNumber, err = generatePublicTicketNumber()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to generate ticket number",
			})
		}

		err = tx.QueryRow(
			`INSERT INTO tickets (ticket_number, user_id, route_id, from_stop_id, to_stop_id, amount, status, qr_code_hash)
			 VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
			 RETURNING purchase_date`,
			ticketNumber,
			userID,
			routeID,
			fromStop.id,
			toStop.id,
			ticketAmount,
			qrHash,
		).Scan(&purchaseDate)

		if err == nil {
			break
		}
		if isTicketNumberConflict(err) {
			continue
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create ticket",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Could not allocate unique ticket number",
		})
	}

	if _, err := tx.Exec(
		`INSERT INTO transactions (user_id, ticket_id, amount, payment_method, status, currency)
		 VALUES ($1, $2, $3, $4, 'completed', 'LKR')`,
		userID,
		ticketNumber,
		ticketAmount,
		strings.TrimSpace(req.PaymentMethod),
	); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create transaction",
		})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to finalize ticket purchase",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"ticketId": ticketNumber,
		"ticketNumber": ticketNumber,
		"ticketDetails": fiber.Map{
			"id":             ticketNumber,
			"ticket_number":  ticketNumber,
			"route_id":       routeID,
			"route_number":   routeNumber,
			"from_stop_id":   fromStop.id,
			"from_stop_name": fromStop.name,
			"to_stop_id":     toStop.id,
			"to_stop_name":   toStop.name,
			"amount":         ticketAmount,
			"status":         "active",
			"purchase_date":  purchaseDate,
			"payment_method": strings.TrimSpace(req.PaymentMethod),
		},
		"qrCode": qrHash,
	})
}

// GetTicket retrieves ticket details
func GetTicket(c *fiber.Ctx) error {
	_ = c.Params("ticketId")

	// TODO: Query ticket from database
	// TODO: Verify user ownership
	// TODO: Return ticket details

	return c.JSON(fiber.Map{
		"ticket": fiber.Map{},
	})
}

// GetUserTickets retrieves all tickets for a user
func GetUserTickets(c *fiber.Ctx) error {
	userParam := strings.TrimSpace(c.Params("userId"))
	userClaim, _ := c.Locals("userId").(string)
	if userClaim == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}
	if userParam == "" || userParam == "me" {
		userParam = userClaim
	}
	if userParam != userClaim {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "You can only view your own tickets",
		})
	}

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit

	rows, err := database.Query(
		`SELECT
			 t.ticket_number,
			 t.route_id,
			 COALESCE(r.route_number, ''),
			 t.from_stop_id,
			 COALESCE(fs.stop_name, ''),
			 t.to_stop_id,
			 COALESCE(ts.stop_name, ''),
			 t.purchase_date,
			 t.amount,
			 t.status
		 FROM tickets t
		 LEFT JOIN routes r ON r.id = t.route_id
		 LEFT JOIN stops fs ON fs.id = t.from_stop_id
		 LEFT JOIN stops ts ON ts.id = t.to_stop_id
		 WHERE t.user_id = $1
		 ORDER BY t.purchase_date DESC
		 LIMIT $2 OFFSET $3`,
		userParam,
		limit,
		offset,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load user tickets",
		})
	}
	defer rows.Close()

	tickets := []fiber.Map{}
	for rows.Next() {
		var ticketNumber sql.NullString
		var routeID string
		var routeNumber string
		var fromStopID sql.NullString
		var fromStopName string
		var toStopID sql.NullString
		var toStopName string
		var purchaseDate time.Time
		var amount float64
		var status string

		if err := rows.Scan(
			&ticketNumber,
			&routeID,
			&routeNumber,
			&fromStopID,
			&fromStopName,
			&toStopID,
			&toStopName,
			&purchaseDate,
			&amount,
			&status,
		); err != nil {
			continue
		}

		tickets = append(tickets, fiber.Map{
			"id":             ticketNumber.String,
			"ticket_number":  ticketNumber.String,
			"route_id":       routeID,
			"route_number":   routeNumber,
			"from_stop_id":   fromStopID.String,
			"from_stop_name": fromStopName,
			"to_stop_id":     toStopID.String,
			"to_stop_name":   toStopName,
			"purchase_date":  purchaseDate,
			"amount":         amount,
			"status":         status,
		})
	}

	var total int
	if err := database.QueryRow(`SELECT COUNT(*) FROM tickets WHERE user_id = $1`, userParam).Scan(&total); err != nil {
		total = len(tickets)
	}

	return c.JSON(fiber.Map{
		"tickets": tickets,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

func generateTicketQRCodeHash() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func generatePublicTicketNumber() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(100000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("TKT-%05d", n.Int64()), nil
}

func isTicketNumberConflict(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		if pqErr.Code == "23505" && strings.Contains(strings.ToLower(pqErr.Message), "ticket_number") {
			return true
		}
		if pqErr.Code == "23505" && strings.Contains(strings.ToLower(string(pqErr.Constraint)), "ticket") {
			return true
		}
	}
	return false
}

// ShareTicket sends ticket details via SMS/WhatsApp
func ShareTicket(c *fiber.Ctx) error {
	_ = c.Params("ticketId")

	type ShareTicketRequest struct {
		PhoneNumber    string `json:"phone_number" validate:"required"`
		DeliveryMethod string `json:"delivery_method"` // sms, whatsapp
	}

	var req ShareTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Fetch ticket details
	// TODO: Send via SMS/WhatsApp using Twilio
	// TODO: Log notification
	// TODO: Return confirmation

	return c.JSON(fiber.Map{
		"success":   true,
		"messageId": "msg-uuid",
	})
}

// ValidateTicket validates a ticket for boarding
func ValidateTicket(c *fiber.Ctx) error {
	type ValidateTicketRequest struct {
		QRCode   string `json:"qr_code"`
		TicketID string `json:"ticket_id"`
	}

	var req ValidateTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Query ticket by QR code or ticket ID
	// TODO: Verify ticket is valid and not expired
	// TODO: Check if ticket is active
	// TODO: Return validation result

	return c.JSON(fiber.Map{
		"valid": true,
		"ticketDetails": fiber.Map{},
	})
}
