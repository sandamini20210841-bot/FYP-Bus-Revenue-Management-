package handlers

import (
	"database/sql"
	"fmt"
	"os"
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
	if dateFrom == "" {
		dateFrom = strings.TrimSpace(c.Query("date_from"))
	}
	if dateTo == "" {
		dateTo = strings.TrimSpace(c.Query("date_to"))
	}
	date := strings.TrimSpace(c.Query("date"))
	if date != "" && dateFrom == "" && dateTo == "" {
		dateFrom = date
		dateTo = date
	}
	if dateFrom != "" && dateTo == "" {
		dateTo = dateFrom
	}
	if dateTo != "" && dateFrom == "" {
		dateFrom = dateTo
	}
	status := strings.TrimSpace(c.Query("status"))
	busNumber := strings.TrimSpace(c.Query("bus"))
	routeNumber := strings.TrimSpace(c.Query("route"))
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
	// Date filtering:
	// The UI typically supplies YYYY-MM-DD (a date without timezone). If we treat that as UTC,
	// transactions near midnight can appear on the "wrong" day for local users.
	// We interpret dates in APP_TIMEZONE (default Asia/Colombo) and convert to a UTC time range.
	if dateFrom != "" || dateTo != "" {
		tzName := strings.TrimSpace(os.Getenv("APP_TIMEZONE"))
		if tzName == "" {
			tzName = "Asia/Colombo"
		}
		loc, err := time.LoadLocation(tzName)
		if err != nil {
			loc = time.UTC
		}

		var startUTC time.Time
		var endUTC time.Time

		if dateFrom != "" {
			startLocal, err := time.ParseInLocation("2006-01-02", dateFrom, loc)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "Invalid dateFrom; expected YYYY-MM-DD",
				})
			}
			startUTC = startLocal.UTC()
			whereParts = append(whereParts, "tr.transaction_date >= $"+itoa(argPos))
			args = append(args, startUTC)
			argPos++
		}

		if dateTo != "" {
			endLocal, err := time.ParseInLocation("2006-01-02", dateTo, loc)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "Invalid dateTo; expected YYYY-MM-DD",
				})
			}
			endUTC = endLocal.AddDate(0, 0, 1).UTC()
			whereParts = append(whereParts, "tr.transaction_date < $"+itoa(argPos))
			args = append(args, endUTC)
			argPos++
		}
	}
	if status != "" {
		whereParts = append(whereParts, "LOWER(tr.status) = LOWER($"+itoa(argPos)+")")
		args = append(args, status)
		argPos++
	}
	if busNumber != "" {
		// Use a trim + case-insensitive compare to avoid missing matches due to case or stray spaces.
		// If the caller provides wildcards, we keep pattern matching.
		if strings.ContainsAny(busNumber, "%_") {
			whereParts = append(whereParts, "(TRIM(COALESCE(t.bus_number, '')) ILIKE TRIM($"+itoa(argPos)+") OR TRIM(COALESCE(r.bus_number, '')) ILIKE TRIM($"+itoa(argPos)+"))")
			args = append(args, busNumber)
			argPos++
		} else {
			whereParts = append(whereParts, "(LOWER(TRIM(COALESCE(t.bus_number, ''))) = LOWER(TRIM($"+itoa(argPos)+")) OR LOWER(TRIM(COALESCE(r.bus_number, ''))) = LOWER(TRIM($"+itoa(argPos)+")))")
			args = append(args, busNumber)
			argPos++
		}
	}
	if routeNumber != "" {
		if strings.ContainsAny(routeNumber, "%_") {
			whereParts = append(whereParts, "TRIM(COALESCE(r.route_number, '')) ILIKE TRIM($"+itoa(argPos)+")")
			args = append(args, routeNumber)
			argPos++
		} else {
			whereParts = append(whereParts, "LOWER(TRIM(COALESCE(r.route_number, ''))) = LOWER(TRIM($"+itoa(argPos)+"))")
			args = append(args, routeNumber)
			argPos++
		}
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

	statsQuery := "SELECT COUNT(*), COALESCE(SUM(tr.amount), 0)::float8 " + baseFrom + whereClause
	var totalCount int
	var totalAmount float64
	if err := database.QueryRow(statsQuery, args...).Scan(&totalCount, &totalAmount); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load transaction totals",
		})
	}

	dataArgs := append([]interface{}{}, args...)
	dataArgs = append(dataArgs, limit, offset)

	dataQuery := `
		SELECT
			tr.id,
			COALESCE(r.route_number, ''),
			COALESCE(t.bus_number, r.bus_number, ''),
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
			"start_destination": fromStop.String,
			"end_destination":   toStop.String,
			"status":           trStatus,
		})
	}

	return c.JSON(fiber.Map{
		"transactions": transactions,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			// `total` is the sum of all amounts matching the filter (across all pages).
			"total": totalAmount,
			// `total_count` is the number of matching rows (used for pagination).
			"total_count": totalCount,
		},
	})
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
