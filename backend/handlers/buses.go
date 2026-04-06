package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
	"github.com/lib/pq"
)

type busRecord struct {
	id         string
	routeID    string
	routeNum   string
	busNumber  string
	ownerID    sql.NullString
	ownerName  sql.NullString
	createdBy  sql.NullString
	createdAt  time.Time
	updatedAt  time.Time
}

func ensureBusesSchema() {
	_, _ = database.Exec(`CREATE TABLE IF NOT EXISTS buses (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
		bus_number VARCHAR(50) NOT NULL,
		owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
		created_by UUID REFERENCES users(id) ON DELETE SET NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (route_id, bus_number)
	)`)
}

func GetBuses(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "buses", "view"); err != nil {
		return err
	}

	ensureBusesSchema()

	role := normalizeRole(fmt.Sprint(c.Locals("userRole")))
	userID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))
	routeID := strings.TrimSpace(c.Query("route_id"))

	where := []string{"1=1"}
	args := []interface{}{}
	argPos := 1

	if routeID != "" {
		where = append(where, "b.route_id = $"+strconv.Itoa(argPos))
		args = append(args, routeID)
		argPos++
	}

	if role == "bus_owner" && userID != "" && userID != "<nil>" {
		where = append(where, "(b.owner_user_id = $"+strconv.Itoa(argPos)+" OR b.created_by = $"+strconv.Itoa(argPos)+")")
		args = append(args, userID)
		argPos++
	}

	query := `SELECT b.id,
	                 b.route_id,
	                 COALESCE(r.route_number, ''),
	                 b.bus_number,
	                 b.owner_user_id::text,
	                 COALESCE(u.full_name, u.email, ''),
	                 b.created_by::text,
	                 b.created_at,
	                 b.updated_at
	          FROM buses b
	          LEFT JOIN routes r ON r.id = b.route_id
	          LEFT JOIN users u ON u.id = b.owner_user_id
	          WHERE ` + strings.Join(where, " AND ") + `
	          ORDER BY b.created_at DESC`

	rows, err := database.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load buses"})
	}
	defer rows.Close()

	buses := []fiber.Map{}
	for rows.Next() {
		var b busRecord
		if scanErr := rows.Scan(&b.id, &b.routeID, &b.routeNum, &b.busNumber, &b.ownerID, &b.ownerName, &b.createdBy, &b.createdAt, &b.updatedAt); scanErr != nil {
			continue
		}
		buses = append(buses, fiber.Map{
			"id": b.id,
			"route_id": b.routeID,
			"route_number": b.routeNum,
			"bus_number": b.busNumber,
			"owner_user_id": b.ownerID.String,
			"owner_name": b.ownerName.String,
			"created_at": b.createdAt,
			"updated_at": b.updatedAt,
		})
	}

	return c.JSON(fiber.Map{"buses": buses})
}

func CreateBus(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "buses", "create"); err != nil {
		return err
	}

	ensureBusesSchema()

	type createBusRequest struct {
		RouteID   string `json:"route_id"`
		BusNumber string `json:"bus_number"`
	}
	var req createBusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	routeID := strings.TrimSpace(req.RouteID)
	busNumber := strings.TrimSpace(req.BusNumber)
	if routeID == "" || busNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id and bus_number are required"})
	}

	creatorID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))
	if creatorID == "<nil>" {
		creatorID = ""
	}

	var ownerUserID sql.NullString
	_ = database.QueryRow(`SELECT created_by::text FROM routes WHERE id = $1`, routeID).Scan(&ownerUserID)

	var id string
	err := database.QueryRow(
		`INSERT INTO buses (route_id, bus_number, owner_user_id, created_by)
		 VALUES ($1, $2, $3, NULLIF($4, ''))
		 RETURNING id`,
		routeID,
		busNumber,
		nullableString(ownerUserID.String),
		creatorID,
	).Scan(&id)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Bus already exists for this route"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create bus"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "bus_id": id})
}

func UpdateBus(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "buses", "edit"); err != nil {
		return err
	}

	busID := strings.TrimSpace(c.Params("busId"))
	if busID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "busId is required"})
	}

	type updateBusRequest struct {
		BusNumber string `json:"bus_number"`
	}
	var req updateBusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	busNumber := strings.TrimSpace(req.BusNumber)
	if busNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bus_number is required"})
	}

	res, err := database.Exec(`UPDATE buses SET bus_number = $1, updated_at = NOW() WHERE id = $2`, busNumber, busID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update bus"})
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Bus not found"})
	}

	return c.JSON(fiber.Map{"success": true})
}

func DeleteBus(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "buses", "delete"); err != nil {
		return err
	}

	busID := strings.TrimSpace(c.Params("busId"))
	if busID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "busId is required"})
	}

	res, err := database.Exec(`DELETE FROM buses WHERE id = $1`, busID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete bus"})
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Bus not found"})
	}

	return c.JSON(fiber.Map{"success": true})
}

func GetRouteDepartures(c *fiber.Ctx) error {
	ensureBusesSchema()

	routeID := strings.TrimSpace(c.Query("route_id"))
	routeNumber := strings.TrimSpace(c.Query("route_number"))
	dateText := strings.TrimSpace(c.Query("date"))
	if dateText == "" {
		dateText = time.Now().Format("2006-01-02")
	}
	depDate, err := time.Parse("2006-01-02", dateText)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid date format. Use YYYY-MM-DD"})
	}

	if routeID == "" && routeNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id or route_number is required"})
	}

	if routeID == "" {
		if err := database.QueryRow(`SELECT id FROM routes WHERE route_number = $1 ORDER BY created_at DESC LIMIT 1`, routeNumber).Scan(&routeID); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid route"})
		}
	}
	if routeNumber == "" {
		_ = database.QueryRow(`SELECT route_number FROM routes WHERE id = $1`, routeID).Scan(&routeNumber)
	}

	times := []string{"05:30", "06:15", "07:00", "07:45", "08:30", "10:00", "11:30", "13:00", "14:30", "16:00", "17:30", "19:00"}

	rows, err := database.Query(`SELECT b.bus_number, COALESCE(u.full_name, u.email, '') FROM buses b LEFT JOIN users u ON u.id = b.owner_user_id WHERE b.route_id = $1 ORDER BY b.bus_number ASC`, routeID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load route buses"})
	}
	defer rows.Close()

	type busItem struct {
		busNumber string
		ownerName string
	}
	buses := []busItem{}
	for rows.Next() {
		var bn string
		var owner string
		if scanErr := rows.Scan(&bn, &owner); scanErr == nil {
			buses = append(buses, busItem{busNumber: bn, ownerName: owner})
		}
	}

	if len(buses) == 0 {
		var fallbackBus sql.NullString
		_ = database.QueryRow(`SELECT bus_number FROM routes WHERE id = $1`, routeID).Scan(&fallbackBus)
		if fallbackBus.Valid && strings.TrimSpace(fallbackBus.String) != "" {
			buses = append(buses, busItem{busNumber: fallbackBus.String, ownerName: ""})
		}
	}

	departures := []fiber.Map{}
	for idx, departureTime := range times {
		selected := busItem{busNumber: "-", ownerName: ""}
		if len(buses) > 0 {
			selected = buses[idx%len(buses)]
		}
		departures = append(departures, fiber.Map{
			"route_id": routeID,
			"route_number": routeNumber,
			"date": depDate.Format("2006-01-02"),
			"departure_time": departureTime,
			"bus_number": selected.busNumber,
			"bus_owner": selected.ownerName,
		})
	}

	return c.JSON(fiber.Map{"departures": departures})
}

func nullableString(v string) interface{} {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

