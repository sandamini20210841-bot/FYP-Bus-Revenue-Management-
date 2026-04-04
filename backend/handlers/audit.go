package handlers

import (
	"fmt"
	"strings"
	"time"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
	"github.com/lib/pq"
)

// GetAuditLogs retrieves audit logs for admin users.
func GetAuditLogs(c *fiber.Ctx) error {
	if !isAdmin(c) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	userID := strings.TrimSpace(c.Query("userId"))
	actionType := strings.TrimSpace(c.Query("actionType"))
	dateFrom := strings.TrimSpace(c.Query("dateFrom"))
	dateTo := strings.TrimSpace(c.Query("dateTo"))

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

	if userID != "" {
		filters = append(filters, "al.user_id = $"+auditItoa(argPos))
		args = append(args, userID)
		argPos++
	}
	if actionType != "" {
		filters = append(filters, "LOWER(al.action) = LOWER($"+auditItoa(argPos)+")")
		args = append(args, actionType)
		argPos++
	}
	if dateFrom != "" {
		filters = append(filters, "al.created_at >= $"+auditItoa(argPos)+"::timestamp")
		args = append(args, dateFrom)
		argPos++
	}
	if dateTo != "" {
		filters = append(filters, "al.created_at <= $"+auditItoa(argPos)+"::timestamp")
		args = append(args, dateTo)
		argPos++
	}

	whereClause := strings.Join(filters, " AND ")

	query := `SELECT al.id,
	                 COALESCE(al.user_id::text, ''),
	                 COALESCE(u.full_name, u.email, 'Unknown user') AS user_name,
	                 COALESCE(al.action, ''),
	                 COALESCE(al.resource, ''),
	                 COALESCE(al.details, ''),
	                 COALESCE(al.ip_address, ''),
	                 al.created_at
	          FROM audit_logs al
	          LEFT JOIN users u ON u.id = al.user_id
	          WHERE ` + whereClause + `
	          ORDER BY al.created_at DESC
	          LIMIT $` + auditItoa(argPos) + ` OFFSET $` + auditItoa(argPos+1)

	args = append(args, limit, offset)

	if _, ensureErr := database.Exec(
		`CREATE TABLE IF NOT EXISTS audit_logs (
		  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
		  action VARCHAR(50) NOT NULL,
		  resource VARCHAR(100),
		  details TEXT,
		  ip_address VARCHAR(64),
		  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
	); ensureErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to initialize audit logs",
		})
	}

	rows, err := database.Query(query, args...)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "42P01" {
			return c.JSON(fiber.Map{
				"logs": []fiber.Map{},
				"pagination": fiber.Map{
					"page":  page,
					"limit": limit,
					"total": 0,
				},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load audit logs",
		})
	}
	defer rows.Close()

	logs := []fiber.Map{}
	for rows.Next() {
		var id string
		var logUserID string
		var userName string
		var action string
		var resource string
		var details string
		var ipAddress string
		var createdAt time.Time

		if scanErr := rows.Scan(&id, &logUserID, &userName, &action, &resource, &details, &ipAddress, &createdAt); scanErr != nil {
			continue
		}

		message := strings.TrimSpace(details)
		if message == "" {
			message = strings.TrimSpace(action)
		}
		if message == "" {
			message = strings.TrimSpace(resource)
		}

		logs = append(logs, fiber.Map{
			"id":        id,
			"userId":    logUserID,
			"userName":  userName,
			"action":    action,
			"resource":  resource,
			"details":   details,
			"message":   strings.TrimSpace(message),
			"ipAddress": ipAddress,
			"timestamp": createdAt,
		})
	}

	countQuery := `SELECT COUNT(*) FROM audit_logs al WHERE ` + whereClause
	countArgs := args[:len(args)-2]
	var total int
	if countErr := database.QueryRow(countQuery, countArgs...).Scan(&total); countErr != nil {
		total = len(logs)
	}

	return c.JSON(fiber.Map{
		"logs": logs,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

func auditItoa(value int) string {
	return fmt.Sprintf("%d", value)
}
