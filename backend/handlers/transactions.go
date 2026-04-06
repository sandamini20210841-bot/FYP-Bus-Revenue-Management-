package handlers

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
)

// GetTransactions retrieves all transactions
func GetTransactions(c *fiber.Ctx) error {
	role := normalizeRole(strings.TrimSpace(fmt.Sprint(c.Locals("userRole"))))
	actorUserID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	if limit > 200 {
		limit = 200
	}

	userID := strings.TrimSpace(c.Query("userId"))
	dateFrom := strings.TrimSpace(c.Query("dateFrom"))
	dateTo := strings.TrimSpace(c.Query("dateTo"))
	status := strings.TrimSpace(c.Query("status"))
	offset := (page - 1) * limit

	baseFrom := `
		FROM transactions tr
		LEFT JOIN tickets t ON t.ticket_number = tr.ticket_id
		LEFT JOIN routes r ON r.id = t.route_id
		LEFT JOIN stops fs ON fs.id = t.from_stop_id
		LEFT JOIN stops ts ON ts.id = t.to_stop_id
	`

	whereParts := []string{}
	args := []interface{}{}
	argPos := 1

	if userID != "" {
		whereParts = append(whereParts, "tr.user_id = $"+itoa(argPos))
		args = append(args, userID)
		argPos++
	}
	if dateFrom != "" {
		whereParts = append(whereParts, "tr.transaction_date >= $"+itoa(argPos)+"::date")
		args = append(args, dateFrom)
		argPos++
	}
	if dateTo != "" {
		whereParts = append(whereParts, "tr.transaction_date < ($"+itoa(argPos)+"::date + INTERVAL '1 day')")
		args = append(args, dateTo)
		argPos++
	}
	if status != "" {
		whereParts = append(whereParts, "LOWER(tr.status) = LOWER($"+itoa(argPos)+")")
		args = append(args, status)
		argPos++
	}
	if role == "bus_owner" && actorUserID != "" && actorUserID != "<nil>" {
		whereParts = append(whereParts, `t.bus_number IN (
			SELECT b.bus_number FROM buses b
			WHERE b.owner_user_id = $`+itoa(argPos)+` OR b.created_by = $`+itoa(argPos)+`
		)`)
		args = append(args, actorUserID)
		argPos++
	}

	whereClause := ""
	if len(whereParts) > 0 {
		whereClause = " WHERE " + strings.Join(whereParts, " AND ")
	}

	countQuery := "SELECT COUNT(*) " + baseFrom + whereClause
	var total int
	if err := database.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to count transactions",
		})
	}

	dataArgs := append([]interface{}{}, args...)
	dataArgs = append(dataArgs, limit, offset)

	dataQuery := `
		SELECT
			tr.id,
			COALESCE(r.route_number, ''),
			COALESCE(t.bus_number, ''),
			COALESCE(tr.ticket_id, ''),
			tr.transaction_date,
			tr.amount,
			COALESCE(fs.stop_name, ''),
			COALESCE(ts.stop_name, ''),
			COALESCE(tr.status, '')
	` + baseFrom + whereClause + `
		ORDER BY tr.transaction_date DESC
		LIMIT $` + itoa(argPos) + ` OFFSET $` + itoa(argPos+1)

	rows, err := database.Query(dataQuery, dataArgs...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load transactions",
		})
	}
	defer rows.Close()

	transactions := []fiber.Map{}
	for rows.Next() {
		var id string
		var routeNumber string
		var busNumber string
		var ticketNumber string
		var transactionDate time.Time
		var amount float64
		var fromStop sql.NullString
		var toStop sql.NullString
		var trStatus string

		if err := rows.Scan(&id, &routeNumber, &busNumber, &ticketNumber, &transactionDate, &amount, &fromStop, &toStop, &trStatus); err != nil {
			continue
		}

		transactions = append(transactions, fiber.Map{
			"id":               id,
			"route_number":     routeNumber,
			"bus_number":       busNumber,
			"ticket_number":    ticketNumber,
			"transaction_date": transactionDate,
			"amount":           amount,
			"from_stop_name":   fromStop.String,
			"to_stop_name":     toStop.String,
			"status":           trStatus,
		})
	}

	return c.JSON(fiber.Map{
		"transactions": transactions,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
