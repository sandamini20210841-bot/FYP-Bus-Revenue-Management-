package handlers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
)

// GetDiscrepancies retrieves discrepancies with optional filters
func GetDiscrepancies(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	status := strings.TrimSpace(c.Query("status"))
	routeNumber := strings.TrimSpace(c.Query("routeNumber"))
	busNumber := strings.TrimSpace(c.Query("busNumber"))
	dateFrom := strings.TrimSpace(c.Query("dateFrom"))
	dateTo := strings.TrimSpace(c.Query("dateTo"))

	role := normalizeRole(fmt.Sprint(c.Locals("userRole")))
	actorUserID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	if limit > 200 {
		limit = 200
	}
	offset := (page - 1) * limit

	filters := []string{"1=1"}
	args := []interface{}{}
	argPos := 1

	if status != "" {
		filters = append(filters, "LOWER(d.status) = LOWER($"+itoa(argPos)+")")
		args = append(args, status)
		argPos++
	}
	if routeNumber != "" {
		filters = append(filters, "LOWER(COALESCE(r.route_number, '')) = LOWER($"+itoa(argPos)+")")
		args = append(args, routeNumber)
		argPos++
	}
	if busNumber != "" {
		filters = append(filters, "LOWER(COALESCE(d.bus_number, '')) = LOWER($"+itoa(argPos)+")")
		args = append(args, busNumber)
		argPos++
	}
	if dateFrom != "" {
		filters = append(filters, "d.transaction_date >= $"+itoa(argPos)+"::date")
		args = append(args, dateFrom)
		argPos++
	}
	if dateTo != "" {
		filters = append(filters, "d.transaction_date <= $"+itoa(argPos)+"::date")
		args = append(args, dateTo)
		argPos++
	}
	if role == "bus_owner" && actorUserID != "" && actorUserID != "<nil>" {
		filters = append(filters, `d.bus_number IN (
			SELECT b.bus_number FROM buses b
			WHERE b.owner_user_id = $`+itoa(argPos)+` OR b.created_by = $`+itoa(argPos)+`
		)`)
		args = append(args, actorUserID)
		argPos++
	}

	whereClause := strings.Join(filters, " AND ")

	countQuery := `SELECT COUNT(*) FROM discrepancies d LEFT JOIN routes r ON r.id = d.route_id WHERE ` + whereClause
	var total int
	if err := database.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to count discrepancies"})
	}

	query := `SELECT d.id,
	                 COALESCE(r.route_number, ''),
	                 COALESCE(d.bus_number, ''),
	                 d.transaction_date,
	                 COALESCE(d.expected_revenue, 0),
	                 COALESCE(d.actual_revenue, 0),
	                 COALESCE(d.loss_amount, 0),
	                 COALESCE(d.status, ''),
	                 COALESCE(d.notes, ''),
	                 d.created_at,
	                 d.updated_at
	          FROM discrepancies d
	          LEFT JOIN routes r ON r.id = d.route_id
	          WHERE ` + whereClause + `
	          ORDER BY d.created_at DESC
	          LIMIT $` + itoa(argPos) + ` OFFSET $` + itoa(argPos+1)

	dataArgs := append([]interface{}{}, args...)
	dataArgs = append(dataArgs, limit, offset)
	rows, err := database.Query(query, dataArgs...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load discrepancies"})
	}
	defer rows.Close()

	items := []fiber.Map{}
	for rows.Next() {
		var id string
		var routeNo string
		var busNo string
		var txDate sql.NullTime
		var expected float64
		var actual float64
		var loss float64
		var itemStatus string
		var notes string
		var createdAt time.Time
		var updatedAt time.Time

		if scanErr := rows.Scan(&id, &routeNo, &busNo, &txDate, &expected, &actual, &loss, &itemStatus, &notes, &createdAt, &updatedAt); scanErr != nil {
			continue
		}

		items = append(items, fiber.Map{
			"id":               id,
			"route_number":     routeNo,
			"bus_number":       busNo,
			"transaction_date": txDate.Time,
			"expected_revenue": expected,
			"actual_revenue":   actual,
			"loss_amount":      loss,
			"status":           itemStatus,
			"notes":            notes,
			"created_at":       createdAt,
			"updated_at":       updatedAt,
		})
	}

	return c.JSON(fiber.Map{
		"discrepancies": items,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetDiscrepancy retrieves a specific discrepancy
func GetDiscrepancy(c *fiber.Ctx) error {
	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	var routeNo string
	var busNo string
	var txDate sql.NullTime
	var expected float64
	var actual float64
	var loss float64
	var itemStatus string
	var notes string
	var createdAt time.Time
	var updatedAt time.Time

	err := database.QueryRow(`SELECT COALESCE(r.route_number, ''), COALESCE(d.bus_number, ''), d.transaction_date,
			COALESCE(d.expected_revenue, 0), COALESCE(d.actual_revenue, 0), COALESCE(d.loss_amount, 0),
			COALESCE(d.status, ''), COALESCE(d.notes, ''), d.created_at, d.updated_at
		FROM discrepancies d
		LEFT JOIN routes r ON r.id = d.route_id
		WHERE d.id = $1`, id).Scan(&routeNo, &busNo, &txDate, &expected, &actual, &loss, &itemStatus, &notes, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Discrepancy not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load discrepancy"})
	}

	return c.JSON(fiber.Map{
		"discrepancy": fiber.Map{
			"id":               id,
			"route_number":     routeNo,
			"bus_number":       busNo,
			"transaction_date": txDate.Time,
			"expected_revenue": expected,
			"actual_revenue":   actual,
			"loss_amount":      loss,
			"status":           itemStatus,
			"notes":            notes,
			"created_at":       createdAt,
			"updated_at":       updatedAt,
		},
	})
}

// UpdateDiscrepancyStatus updates the status of a discrepancy
func UpdateDiscrepancyStatus(c *fiber.Ctx) error {
	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	type UpdateStatusRequest struct {
		Status string `json:"status" validate:"required,oneof=pending investigating resolved"`
		Notes  string `json:"notes"`
	}

	var req UpdateStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Status != "pending" && req.Status != "investigating" && req.Status != "resolved" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid status"})
	}

	res, err := database.Exec(
		`UPDATE discrepancies SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3`,
		req.Status,
		strings.TrimSpace(req.Notes),
		id,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update discrepancy"})
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Discrepancy not found"})
	}

	return c.JSON(fiber.Map{
		"success":     true,
		"discrepancy": fiber.Map{"id": id, "status": req.Status, "notes": strings.TrimSpace(req.Notes)},
	})
}

// GetDiscrepancyStats retrieves discrepancy statistics
func GetDiscrepancyStats(c *fiber.Ctx) error {
	var total int
	_ = database.QueryRow(`SELECT COUNT(*) FROM discrepancies`).Scan(&total)

	byStatus := fiber.Map{}
	statusRows, _ := database.Query(`SELECT status, COUNT(*) FROM discrepancies GROUP BY status`)
	if statusRows != nil {
		defer statusRows.Close()
		for statusRows.Next() {
			var status string
			var count int
			if err := statusRows.Scan(&status, &count); err == nil {
				byStatus[status] = count
			}
		}
	}

	byRoute := fiber.Map{}
	routeRows, _ := database.Query(`SELECT COALESCE(r.route_number, ''), COUNT(*) FROM discrepancies d LEFT JOIN routes r ON r.id = d.route_id GROUP BY COALESCE(r.route_number, '')`)
	if routeRows != nil {
		defer routeRows.Close()
		for routeRows.Next() {
			var route string
			var count int
			if err := routeRows.Scan(&route, &count); err == nil {
				byRoute[route] = count
			}
		}
	}

	var totalLoss float64
	_ = database.QueryRow(`SELECT COALESCE(SUM(loss_amount), 0) FROM discrepancies`).Scan(&totalLoss)

	return c.JSON(fiber.Map{
		"totalDiscrepancies": total,
		"byStatus":           byStatus,
		"byRoute":            byRoute,
		"totalLoss":          totalLoss,
	})
}
