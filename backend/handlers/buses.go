package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
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

func ensureTimetableSchema() error {
	if _, err := database.Exec(`CREATE TABLE IF NOT EXISTS timetable_setups (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		route_id UUID NOT NULL UNIQUE REFERENCES routes(id) ON DELETE CASCADE,
		total_turns INT NOT NULL CHECK (total_turns > 0 AND total_turns <= 200),
		created_by UUID REFERENCES users(id) ON DELETE SET NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return err
	}

	if _, err := database.Exec(`CREATE TABLE IF NOT EXISTS timetable_entries (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
		service_date DATE NOT NULL,
		turn_number INT NOT NULL CHECK (turn_number > 0),
		bus_number VARCHAR(50) NOT NULL,
		departure_time VARCHAR(5) NOT NULL DEFAULT '',
		created_by UUID REFERENCES users(id) ON DELETE SET NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (route_id, service_date, turn_number)
	)`); err != nil {
		return err
	}

	if _, err := database.Exec(`ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS departure_time VARCHAR(5) NOT NULL DEFAULT ''`); err != nil {
		return err
	}

	return nil
}

func turnNumberToTime(turn int) string {
	if turn < 1 {
		turn = 1
	}
	startMinutes := 5*60 + 30 // 05:30
	mins := startMinutes + (turn-1)*30
	hh := (mins / 60) % 24
	mm := mins % 60
	return fmt.Sprintf("%02d:%02d", hh, mm)
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
	                 COALESCE(creator.full_name, creator.email, ''),
	                 b.created_by::text,
	                 b.created_at,
	                 b.updated_at
	          FROM buses b
	          LEFT JOIN routes r ON r.id = b.route_id
	          LEFT JOIN users creator ON creator.id = b.created_by
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
		 VALUES ($1, $2, $3, NULLIF($4, '')::uuid)
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
	if err := ensureTimetableSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize timetable schema"})
	}

	role := normalizeRole(fmt.Sprint(c.Locals("userRole")))
	userID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))

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

	busesQuery := `SELECT b.bus_number, COALESCE(u.full_name, u.email, '')
		FROM buses b
		LEFT JOIN users u ON u.id = b.created_by
		WHERE b.route_id = $1`
	busesArgs := []interface{}{routeID}
	if role == "bus_owner" && userID != "" && userID != "<nil>" {
		busesQuery += ` AND (b.created_by = $2 OR b.owner_user_id = $2)`
		busesArgs = append(busesArgs, userID)
	}
	busesQuery += ` ORDER BY b.bus_number ASC`

	rows, err := database.Query(busesQuery, busesArgs...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load route buses"})
	}
	defer rows.Close()

	type busItem struct {
		busNumber string
		ownerName string
	}
	buses := []busItem{}
	ownerByBus := map[string]string{}
	for rows.Next() {
		var bn string
		var owner string
		if scanErr := rows.Scan(&bn, &owner); scanErr == nil {
			buses = append(buses, busItem{busNumber: bn, ownerName: owner})
			ownerByBus[strings.TrimSpace(bn)] = owner
		}
	}

	if len(buses) == 0 {
		var fallbackBus sql.NullString
		_ = database.QueryRow(`SELECT bus_number FROM routes WHERE id = $1`, routeID).Scan(&fallbackBus)
		if fallbackBus.Valid && strings.TrimSpace(fallbackBus.String) != "" {
			buses = append(buses, busItem{busNumber: fallbackBus.String, ownerName: ""})
		}
	}

	// If a timetable exists, show only assigned turns for that date.
	var totalTurns int
	setupErr := database.QueryRow(`SELECT total_turns FROM timetable_setups WHERE route_id = $1`, routeID).Scan(&totalTurns)

	departures := []fiber.Map{}
	if setupErr == sql.ErrNoRows {
		// No timetable configured for this route: return empty departures so
		// clients can show an explicit "no timetable" state instead of
		// rendering a default/sample schedule.
		return c.JSON(fiber.Map{"departures": departures, "total_turns": 0, "has_setup": false})
	}
	if setupErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load timetable setup"})
	}

	// setupErr == nil -> proceed to load entries
	if setupErr == nil {
		entriesQuery := `SELECT e.turn_number, e.bus_number, COALESCE(e.departure_time, '')
			FROM timetable_entries e
			WHERE e.route_id = $1 AND e.service_date = $2::date`
		entriesArgs := []interface{}{routeID, depDate.Format("2006-01-02")}
		if role == "bus_owner" && userID != "" && userID != "<nil>" {
			entriesQuery += `
				AND EXISTS (
					SELECT 1
					FROM buses b
					WHERE b.route_id = e.route_id
					  AND b.bus_number = e.bus_number
					  AND (b.created_by = $3 OR b.owner_user_id = $3)
				)`
			entriesArgs = append(entriesArgs, userID)
		}
		entriesQuery += ` ORDER BY e.turn_number ASC`

		entryRows, entriesErr := database.Query(entriesQuery, entriesArgs...)
		if entriesErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load timetable entries"})
		}
		defer entryRows.Close()

		for entryRows.Next() {
			var turn int
			var busNo string
			var departureTime string
			if scanErr := entryRows.Scan(&turn, &busNo, &departureTime); scanErr != nil {
				continue
			}
			if strings.TrimSpace(departureTime) == "" {
				departureTime = turnNumberToTime(turn)
			}

			departures = append(departures, fiber.Map{
				"route_id": routeID,
				"route_number": routeNumber,
				"date": depDate.Format("2006-01-02"),
				"turn_number": turn,
				"departure_time": departureTime,
				"bus_number": busNo,
				"bus_owner": ownerByBus[strings.TrimSpace(busNo)],
			})
		}

		return c.JSON(fiber.Map{"departures": departures, "total_turns": totalTurns})
	}

	// No fallback/sample schedule when no timetable setup exists.
	return c.JSON(fiber.Map{"departures": departures, "total_turns": totalTurns, "has_setup": true})
}

func UpsertTimetableSetup(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "timetable", "create"); err != nil {
		return err
	}

	if err := ensureTimetableSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize timetable schema"})
	}

	type reqBody struct {
		RouteID    string `json:"route_id"`
		TotalTurns int    `json:"total_turns"`
	}
	var req reqBody
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	routeID := strings.TrimSpace(req.RouteID)
	if routeID == "" || req.TotalTurns < 1 || req.TotalTurns > 200 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id and total_turns (1-200) are required"})
	}

	actorUserID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))
	if actorUserID == "<nil>" {
		actorUserID = ""
	}

	_, err := database.Exec(
		`INSERT INTO timetable_setups (route_id, total_turns, created_by)
		 VALUES ($1, $2, NULLIF($3, '')::uuid)
		 ON CONFLICT (route_id)
		 DO UPDATE SET total_turns = EXCLUDED.total_turns, updated_at = NOW()`,
		routeID,
		req.TotalTurns,
		actorUserID,
	)
	if err != nil {
		log.Printf("failed to save timetable setup route_id=%s turns=%d actor=%s err=%v", routeID, req.TotalTurns, actorUserID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to save timetable setup: %v", err)})
	}

	return c.JSON(fiber.Map{"success": true, "route_id": routeID, "total_turns": req.TotalTurns})
}

func GetTimetableSetup(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "timetable", "view"); err != nil {
		return err
	}

	if err := ensureTimetableSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize timetable schema"})
	}
	routeID := strings.TrimSpace(c.Query("route_id"))
	if routeID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id is required"})
	}

	var totalTurns int
	err := database.QueryRow(`SELECT total_turns FROM timetable_setups WHERE route_id = $1`, routeID).Scan(&totalTurns)
	if err == sql.ErrNoRows {
		return c.JSON(fiber.Map{"setup": nil})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load timetable setup"})
	}

	return c.JSON(fiber.Map{"setup": fiber.Map{"route_id": routeID, "total_turns": totalTurns}})
}

func UpsertTimetableEntry(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "timetable", "create"); err != nil {
		return err
	}

	ensureBusesSchema()
	if err := ensureTimetableSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize timetable schema"})
	}

	type reqBody struct {
		RouteID    string `json:"route_id"`
		Date       string `json:"date"`
		TurnNumber int    `json:"turn_number"`
		BusNumber  string `json:"bus_number"`
		Departure  string `json:"departure_time"`
	}
	var req reqBody
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	routeID := strings.TrimSpace(req.RouteID)
	dateText := strings.TrimSpace(req.Date)
	busNumber := strings.TrimSpace(req.BusNumber)
	departureTime := strings.TrimSpace(req.Departure)
	if routeID == "" || dateText == "" || req.TurnNumber < 1 || busNumber == "" || departureTime == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id, date, turn_number, bus_number and departure_time are required"})
	}

	if _, err := time.Parse("2006-01-02", dateText); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid date format. Use YYYY-MM-DD"})
	}

	if _, err := time.Parse("15:04", departureTime); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid departure_time format. Use HH:MM"})
	}

	var totalTurns int
	if err := database.QueryRow(`SELECT total_turns FROM timetable_setups WHERE route_id = $1`, routeID).Scan(&totalTurns); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Please set total turns for this route first"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to validate timetable setup"})
	}

	if req.TurnNumber > totalTurns {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Turn exceeds configured total turns"})
	}

	var exists int
	if err := database.QueryRow(`SELECT 1 FROM buses WHERE route_id = $1 AND bus_number = $2`, routeID, busNumber).Scan(&exists); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Bus number is not registered for this route"})
	}

	actorUserID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))
	if actorUserID == "<nil>" {
		actorUserID = ""
	}

	_, err := database.Exec(
		`INSERT INTO timetable_entries (route_id, service_date, turn_number, bus_number, departure_time, created_by)
		 VALUES ($1, $2::date, $3, $4, $5, NULLIF($6, '')::uuid)
		 ON CONFLICT (route_id, service_date, turn_number)
		 DO UPDATE SET bus_number = EXCLUDED.bus_number, departure_time = EXCLUDED.departure_time, updated_at = NOW()`,
		routeID,
		dateText,
		req.TurnNumber,
		busNumber,
		departureTime,
		actorUserID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save timetable entry"})
	}

	return c.JSON(fiber.Map{"success": true})
}

func DeleteTimetableEntry(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "timetable", "delete"); err != nil {
		return err
	}

	if err := ensureTimetableSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize timetable schema"})
	}

	type reqBody struct {
		RouteID    string `json:"route_id"`
		Date       string `json:"date"`
		TurnNumber int    `json:"turn_number"`
	}
	var req reqBody
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	routeID := strings.TrimSpace(req.RouteID)
	dateText := strings.TrimSpace(req.Date)
	if routeID == "" || dateText == "" || req.TurnNumber < 1 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id, date and turn_number are required"})
	}

	if _, err := time.Parse("2006-01-02", dateText); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid date format. Use YYYY-MM-DD"})
	}

	res, err := database.Exec(
		`DELETE FROM timetable_entries WHERE route_id = $1 AND service_date = $2::date AND turn_number = $3`,
		routeID,
		dateText,
		req.TurnNumber,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete timetable entry"})
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Timetable entry not found"})
	}

	return c.JSON(fiber.Map{"success": true})
}

func DeleteTimetableDate(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "timetable", "delete"); err != nil {
		return err
	}

	if err := ensureTimetableSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize timetable schema"})
	}

	type reqBody struct {
		RouteID string `json:"route_id"`
		Date    string `json:"date"`
	}
	var req reqBody
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	routeID := strings.TrimSpace(req.RouteID)
	dateText := strings.TrimSpace(req.Date)
	if routeID == "" || dateText == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id and date are required"})
	}

	if _, err := time.Parse("2006-01-02", dateText); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid date format. Use YYYY-MM-DD"})
	}

	res, err := database.Exec(`DELETE FROM timetable_entries WHERE route_id = $1 AND service_date = $2::date`, routeID, dateText)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete timetable date"})
	}

	affected, _ := res.RowsAffected()
	return c.JSON(fiber.Map{"success": true, "deleted_count": affected})
}

func GetTimetableEntries(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "timetable", "view"); err != nil {
		return err
	}

	if err := ensureTimetableSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize timetable schema"})
	}
	routeID := strings.TrimSpace(c.Query("route_id"))
	dateText := strings.TrimSpace(c.Query("date"))
	if routeID == "" || dateText == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id and date are required"})
	}

	rows, err := database.Query(
		`SELECT e.turn_number, e.bus_number, COALESCE(u.full_name, u.email, ''), COALESCE(e.departure_time, '')
		 FROM timetable_entries e
		 LEFT JOIN buses b ON b.route_id = e.route_id AND b.bus_number = e.bus_number
		 LEFT JOIN users u ON u.id = b.owner_user_id
		 WHERE e.route_id = $1 AND e.service_date = $2::date
		 ORDER BY e.turn_number ASC`,
		routeID,
		dateText,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load timetable entries"})
	}
	defer rows.Close()

	entries := []fiber.Map{}
	for rows.Next() {
		var turn int
		var busNo string
		var owner string
		var departureTime string
		if scanErr := rows.Scan(&turn, &busNo, &owner, &departureTime); scanErr != nil {
			continue
		}
		entries = append(entries, fiber.Map{
			"turn_number": turn,
			"bus_number": busNo,
			"bus_owner": owner,
			"departure_time": departureTime,
		})
	}

	return c.JSON(fiber.Map{"entries": entries})
}

func GetTimetableCalendar(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "timetable", "view"); err != nil {
		return err
	}

	if err := ensureTimetableSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize timetable schema"})
	}

	routeID := strings.TrimSpace(c.Query("route_id"))
	if routeID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "route_id is required"})
	}

	var totalTurns int
	if err := database.QueryRow(`SELECT total_turns FROM timetable_setups WHERE route_id = $1`, routeID).Scan(&totalTurns); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(fiber.Map{"route_id": routeID, "dates": []fiber.Map{}})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load timetable setup"})
	}

	rows, err := database.Query(
		`SELECT service_date::text, COUNT(*)
		 FROM timetable_entries
		 WHERE route_id = $1
		 GROUP BY service_date
		 ORDER BY service_date ASC`,
		routeID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load timetable calendar"})
	}
	defer rows.Close()

	dates := []fiber.Map{}
	for rows.Next() {
		var dateText string
		var assignedTurns int
		if scanErr := rows.Scan(&dateText, &assignedTurns); scanErr != nil {
			continue
		}
		dates = append(dates, fiber.Map{
			"date":           dateText,
			"assigned_turns": assignedTurns,
			"total_turns":    totalTurns,
			"is_complete":    totalTurns > 0 && assignedTurns >= totalTurns,
		})
	}

	return c.JSON(fiber.Map{"route_id": routeID, "dates": dates})
}

func nullableString(v string) interface{} {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

