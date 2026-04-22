package handlers

import (
	"database/sql"
	"log"
	"strconv"
	"strings"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
)

// StopInput represents a stop payload from the client
type StopInput struct {
	Name     string `json:"name"`
	Distance string `json:"distance"`
	Amount   string `json:"amount"`
}

// StopResponse represents a stop returned to the client
type StopResponse struct {
	Name       string   `json:"name"`
	DistanceKm *float64 `json:"distance_km,omitempty"`
	Amount     *float64 `json:"amount,omitempty"`
}

type RouteResponse struct {
	ID          string         `json:"id"`
	RouteNumber string         `json:"route_number"`
	BusNumber   string         `json:"bus_number"`
	Description string         `json:"description"`
	Latitude    *float64       `json:"latitude,omitempty"`
	Longitude   *float64       `json:"longitude,omitempty"`
	Stops       []StopResponse `json:"stops"`
	StopsCount  int            `json:"stops_count"`
}

func loadStopsForRoute(routeID string) ([]StopResponse, error) {
	stopRows, err := database.Query(
		`SELECT stop_name, distance_km, amount
		 FROM stops
		 WHERE route_id = $1
		 ORDER BY sequence_order ASC`,
		routeID,
	)
	if err != nil {
		return nil, err
	}
	defer stopRows.Close()

	stops := make([]StopResponse, 0)
	for stopRows.Next() {
		var name string
		var distance sql.NullFloat64
		var amount sql.NullFloat64
		if err := stopRows.Scan(&name, &distance, &amount); err != nil {
			log.Printf("failed to scan stop for route %s: %v", routeID, err)
			continue
		}

		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}

		stop := StopResponse{Name: trimmed}
		if distance.Valid {
			v := distance.Float64
			stop.DistanceKm = &v
		}
		if amount.Valid {
			v := amount.Float64
			stop.Amount = &v
		}
		stops = append(stops, stop)
	}

	return stops, nil
}

// CreateRoute creates a new bus route
func CreateRoute(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "routes", "create"); err != nil {
		return err
	}

	type CreateRouteRequest struct {
		RouteNumber string      `json:"route_number" validate:"required"`
		BusNumber   string      `json:"bus_number"`
		Stops       []StopInput `json:"stops" validate:"required"`
		Description string      `json:"description"`
		Latitude    *float64    `json:"latitude"`
		Longitude   *float64    `json:"longitude"`
	}

	var req CreateRouteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Basic validation to ensure required data is present
	if strings.TrimSpace(req.RouteNumber) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "route_number is required",
		})
	}
	if len(req.Stops) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "At least one stop is required",
		})
	}

	// Use a DB transaction to avoid partial inserts on retries and to provide
	// an opportunity to reject duplicate route numbers.
	tx, err := database.PostgresDB.Begin()
	if err != nil {
		log.Printf("failed to start transaction for create route: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create route"})
	}
	defer tx.Rollback()

	// Prevent duplicate route numbers (race window still possible without a
	// unique constraint, but this avoids common duplicate inserts).
	var existingID string
	if err := tx.QueryRow(`SELECT id FROM routes WHERE route_number = $1 LIMIT 1`, strings.TrimSpace(req.RouteNumber)).Scan(&existingID); err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Route with this number already exists"})
	}

	var routeID string
	var latitude sql.NullFloat64
	var longitude sql.NullFloat64
	if req.Latitude != nil {
		latitude = sql.NullFloat64{Float64: *req.Latitude, Valid: true}
	}
	if req.Longitude != nil {
		longitude = sql.NullFloat64{Float64: *req.Longitude, Valid: true}
	}

	err = tx.QueryRow(
		`INSERT INTO routes (route_number, bus_number, description, latitude, longitude)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		strings.TrimSpace(req.RouteNumber),
		strings.TrimSpace(req.BusNumber),
		strings.TrimSpace(req.Description),
		latitude,
		longitude,
	).Scan(&routeID)
	if err != nil {
		log.Printf("failed to insert route: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create route"})
	}

	// Insert stops for this route inside the same transaction.
	sequence := 1
	for _, stop := range req.Stops {
		name := strings.TrimSpace(stop.Name)
		if name == "" {
			continue
		}

		var distance sql.NullFloat64
		var amount sql.NullFloat64

		if d := strings.TrimSpace(stop.Distance); d != "" {
			if v, err := parseToFloat(d); err == nil {
				distance = sql.NullFloat64{Float64: v, Valid: true}
			}
		}
		if a := strings.TrimSpace(stop.Amount); a != "" {
			if v, err := parseToFloat(a); err == nil {
				amount = sql.NullFloat64{Float64: v, Valid: true}
			}
		}
		if _, err := tx.Exec(
			`INSERT INTO stops (route_id, stop_name, sequence_order, distance_km, amount)
			 VALUES ($1, $2, $3, $4, $5)`,
			routeID,
			name,
			sequence,
			distance,
			amount,
		); err != nil {
			log.Printf("failed to insert stop for route %s: %v", routeID, err)
			continue
		}
		sequence++
	}

	if err := tx.Commit(); err != nil {
		log.Printf("failed to commit create route tx: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create route"})
	}

	// TODO: Verify user is bus_owner
	// TODO: Create audit log

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"route": fiber.Map{
			"id":           routeID,
			"route_number": strings.TrimSpace(req.RouteNumber),
			"bus_number":   strings.TrimSpace(req.BusNumber),
			"description":  strings.TrimSpace(req.Description),
			"latitude":     req.Latitude,
			"longitude":    req.Longitude,
			"stops":        req.Stops,
		},
	})
}

// GetRoutes retrieves all routes
func GetRoutes(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "routes", "view"); err != nil {
		return err
	}

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	_ = c.Query("routeNumber")
	_ = c.Query("busNumber")

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	includeStops := true
	if rawIncludeStops := strings.TrimSpace(c.Query("include_stops")); rawIncludeStops != "" {
		if parsed, err := strconv.ParseBool(rawIncludeStops); err == nil {
			includeStops = parsed
		}
	}

	offset := (page - 1) * limit

	// Query routes from database (newest first)
	rows, err := database.Query(
		`SELECT r.id,
		        r.route_number,
				r.bus_number,
				r.description,
				r.latitude,
				r.longitude,
				COALESCE(sc.stop_count, 0) AS stop_count
		 FROM routes r
		 LEFT JOIN (
			SELECT route_id, COUNT(*) AS stop_count
			FROM stops
			GROUP BY route_id
		 ) sc ON sc.route_id = r.id
		 ORDER BY created_at DESC
		 LIMIT $1 OFFSET $2`,
		limit,
		offset,
	)
	if err != nil {
		log.Printf("failed to query routes: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load routes",
		})
	}
	defer rows.Close()

	routes := []RouteResponse{}
	for rows.Next() {
		r := RouteResponse{}
		var latitude sql.NullFloat64
		var longitude sql.NullFloat64
		if err := rows.Scan(
			&r.ID,
			&r.RouteNumber,
			&r.BusNumber,
			&r.Description,
			&latitude,
			&longitude,
			&r.StopsCount,
		); err != nil {
			log.Printf("failed to scan route row: %v", err)
			continue
		}
		if latitude.Valid {
			v := latitude.Float64
			r.Latitude = &v
		}
		if longitude.Valid {
			v := longitude.Float64
			r.Longitude = &v
		}

		if includeStops {
			stops, stopsErr := loadStopsForRoute(r.ID)
			if stopsErr != nil {
				log.Printf("failed to query stops for route %s: %v", r.ID, stopsErr)
			} else {
				r.Stops = stops
			}
		}

		routes = append(routes, r)
	}

	var total int
	if err := database.QueryRow(`SELECT COUNT(*) FROM routes`).Scan(&total); err != nil {
		log.Printf("failed to count routes: %v", err)
	}

	return c.JSON(fiber.Map{
		"routes": routes,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetRoute retrieves a specific route
func GetRoute(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "routes", "view"); err != nil {
		return err
	}

	routeID := strings.TrimSpace(c.Params("routeId"))
	if routeID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "routeId is required",
		})
	}

	route := RouteResponse{
		Stops: make([]StopResponse, 0),
	}
	var latitude sql.NullFloat64
	var longitude sql.NullFloat64
	err := database.QueryRow(
		`SELECT r.id,
		        r.route_number,
				r.bus_number,
				r.description,
				r.latitude,
				r.longitude,
				COALESCE(sc.stop_count, 0) AS stop_count
		 FROM routes r
		 LEFT JOIN (
			SELECT route_id, COUNT(*) AS stop_count
			FROM stops
			GROUP BY route_id
		 ) sc ON sc.route_id = r.id
		 WHERE r.id = $1`,
		routeID,
	).Scan(
		&route.ID,
		&route.RouteNumber,
		&route.BusNumber,
		&route.Description,
		&latitude,
		&longitude,
		&route.StopsCount,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Route not found",
			})
		}

		log.Printf("failed to query route %s: %v", routeID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load route",
		})
	}

	if latitude.Valid {
		v := latitude.Float64
		route.Latitude = &v
	}
	if longitude.Valid {
		v := longitude.Float64
		route.Longitude = &v
	}

	stops, stopErr := loadStopsForRoute(route.ID)
	if stopErr != nil {
		log.Printf("failed to query stops for route %s: %v", route.ID, stopErr)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load route stops",
		})
	}
	route.Stops = stops

	return c.JSON(fiber.Map{
		"route": route,
	})
}

// UpdateRoute updates a route
func UpdateRoute(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "routes", "edit"); err != nil {
		return err
	}

	routeID := c.Params("routeId")
	if strings.TrimSpace(routeID) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "routeId is required",
		})
	}

	type UpdateRouteRequest struct {
		RouteNumber string      `json:"route_number"`
		BusNumber   string      `json:"bus_number"`
		Stops       []StopInput `json:"stops"`
		Description string      `json:"description"`
		Latitude    *float64    `json:"latitude"`
		Longitude   *float64    `json:"longitude"`
	}

	var req UpdateRouteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Basic validation
	if strings.TrimSpace(req.RouteNumber) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "route_number is required",
		})
	}
	if len(req.Stops) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "At least one stop is required",
		})
	}

	var latitude sql.NullFloat64
	var longitude sql.NullFloat64
	if req.Latitude != nil {
		latitude = sql.NullFloat64{Float64: *req.Latitude, Valid: true}
	}
	if req.Longitude != nil {
		longitude = sql.NullFloat64{Float64: *req.Longitude, Valid: true}
	}

	// Use a transaction for update to avoid partial state if insertion fails
	tx, err := database.PostgresDB.Begin()
	if err != nil {
		log.Printf("failed to start transaction for update route %s: %v", routeID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update route"})
	}
	defer tx.Rollback()

	// Lock the route row to serialize concurrent updates and prevent duplicate
	// stop writes while the route is being edited.
	var exists string
	if err := tx.QueryRow(`SELECT id FROM routes WHERE id = $1 FOR UPDATE`, routeID).Scan(&exists); err != nil {
		log.Printf("route %s not found for update: %v", routeID, err)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Route not found"})
	}

	if _, err := tx.Exec(
		`UPDATE routes
		 SET route_number = $1,
			 bus_number = $2,
			 description = $3,
			 latitude = $4,
			 longitude = $5,
			 updated_at = NOW()
		 WHERE id = $6`,
		strings.TrimSpace(req.RouteNumber),
		strings.TrimSpace(req.BusNumber),
		strings.TrimSpace(req.Description),
		latitude,
		longitude,
		routeID,
	); err != nil {
		log.Printf("failed to update route %s: %v", routeID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update route"})
	}

	validStops := []StopInput{}
	for _, stop := range req.Stops {
		name := strings.TrimSpace(stop.Name)
		if name == "" {
			continue
		}
		validStops = append(validStops, StopInput{
			Name:     name,
			Distance: strings.TrimSpace(stop.Distance),
			Amount:   strings.TrimSpace(stop.Amount),
		})
	}
	if len(validStops) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "At least one valid stop is required"})
	}

	if _, err := tx.Exec(`DELETE FROM stops WHERE route_id = $1`, routeID); err != nil {
		log.Printf("failed to delete stops for route %s: %v", routeID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update route stops"})
	}

	sequence := 1
	for _, stop := range validStops {
		var distance sql.NullFloat64
		var amount sql.NullFloat64

		if stop.Distance != "" {
			if v, err := parseToFloat(stop.Distance); err == nil {
				distance = sql.NullFloat64{Float64: v, Valid: true}
			}
		}
		if stop.Amount != "" {
			if v, err := parseToFloat(stop.Amount); err == nil {
				amount = sql.NullFloat64{Float64: v, Valid: true}
			}
		}

		if _, err := tx.Exec(
			`INSERT INTO stops (route_id, stop_name, sequence_order, distance_km, amount)
			 VALUES ($1, $2, $3, $4, $5)`,
			routeID,
			stop.Name,
			sequence,
			distance,
			amount,
		); err != nil {
			log.Printf("failed to insert stop for route %s: %v", routeID, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save route stops"})
		}
		sequence++
	}

	if err := tx.Commit(); err != nil {
		log.Printf("failed to commit update route tx %s: %v", routeID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update route"})
	}

	// TODO: Verify user is bus_owner who created this route
	// TODO: Create audit log

	return c.JSON(fiber.Map{
		"success": true,
		"route": fiber.Map{
			"id":           routeID,
			"route_number": strings.TrimSpace(req.RouteNumber),
			"bus_number":   strings.TrimSpace(req.BusNumber),
			"description":  strings.TrimSpace(req.Description),
			"latitude":     req.Latitude,
			"longitude":    req.Longitude,
			"stops":        req.Stops,
		},
	})
}

// parseToFloat converts a numeric string to float64, ignoring errors by caller.
func parseToFloat(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}

// DeleteRoute deletes a route
func DeleteRoute(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "routes", "delete"); err != nil {
		return err
	}

	routeID := strings.TrimSpace(c.Params("routeId"))
	if routeID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "routeId is required",
		})
	}

	// TODO: Verify user is bus_owner who created this route

	tx, err := database.PostgresDB.Begin()
	if err != nil {
		log.Printf("failed to start delete transaction for route %s: %v", routeID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete route",
		})
	}
	defer tx.Rollback()

	// Avoid waiting indefinitely on locked rows.
	if _, err := tx.Exec(`SET LOCAL lock_timeout = '4s'`); err != nil {
		log.Printf("failed to set lock timeout for route delete %s: %v", routeID, err)
	}

	// Lock the route row to serialize deletes/updates and avoid race conditions
	// with concurrent updates that may hold locks on dependent rows.
	var locked string
	if err := tx.QueryRow(`SELECT id FROM routes WHERE id = $1 FOR UPDATE NOWAIT`, routeID).Scan(&locked); err != nil {
		errText := strings.ToLower(err.Error())
		if strings.Contains(errText, "could not obtain lock on row") || strings.Contains(errText, "lock timeout") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "Route is being updated by another request. Please retry in a few seconds.",
			})
		}
		log.Printf("route %s not found for delete: %v", routeID, err)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Route not found"})
	}

	// Preserve ticket/transaction history when possible by detaching route links.
	if _, err := tx.Exec(`UPDATE tickets SET route_id = NULL WHERE route_id = $1`, routeID); err != nil {
		log.Printf("failed to detach tickets from route %s: %v", routeID, err)

		// If this failed due to NOT NULL constraints, attempt fallback delete.
		errText := strings.ToLower(err.Error())
		isRouteIDNotNull := strings.Contains(errText, "route_id") && strings.Contains(errText, "not-null")
		isNullViolation := strings.Contains(errText, "null value") && strings.Contains(errText, "route_id")

		if isRouteIDNotNull || isNullViolation {
			// Older schemas may keep tickets.route_id as NOT NULL. Fall back to deleting linked tickets
			// so route deletion still succeeds and transactions remain (ticket_id becomes NULL via FK).
			if _, deleteErr := tx.Exec(`DELETE FROM tickets WHERE route_id = $1`, routeID); deleteErr != nil {
				log.Printf("failed to delete tickets for route %s during fallback: %v", routeID, deleteErr)
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{
					"error": "Route cannot be deleted because related ticket records could not be updated",
				})
			}
		} else {
			// Likely a lock/timeout issue; return a retryable conflict to the client.
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "Route is currently locked or the database is busy; please retry shortly",
			})
		}
	}

	if _, err := tx.Exec(`UPDATE discrepancies SET route_id = NULL WHERE route_id = $1`, routeID); err != nil {
		log.Printf("failed to detach discrepancies from route %s: %v", routeID, err)
	}

	result, err := tx.Exec(`DELETE FROM routes WHERE id = $1`, routeID)
	if err != nil {
		log.Printf("failed to delete route %s: %v", routeID, err)
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Route cannot be deleted because it is still referenced by related records",
		})
	}

	rows, err := result.RowsAffected()
	if err != nil {
		log.Printf("failed to get rows affected for delete route %s: %v", routeID, err)
	}
	if rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Route not found",
		})
	}

	if err := tx.Commit(); err != nil {
		log.Printf("failed to commit route delete %s: %v", routeID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to finalize route deletion",
		})
	}

	// Associated stops are removed automatically via ON DELETE CASCADE in the schema
	// TODO: Create audit log

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Route deleted successfully",
	})
}
