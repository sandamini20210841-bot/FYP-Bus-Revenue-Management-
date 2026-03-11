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

// CreateRoute creates a new bus route
func CreateRoute(c *fiber.Ctx) error {
	type CreateRouteRequest struct {
		RouteNumber string      `json:"route_number" validate:"required"`
		BusNumber   string      `json:"bus_number"`
		Stops       []StopInput `json:"stops" validate:"required"`
		Description string      `json:"description"`
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

	// Insert route into PostgreSQL. created_by is left NULL for now until
	// authentication is wired and we can associate the route with a user.
	var routeID string
	err := database.QueryRow(
		`INSERT INTO routes (route_number, bus_number, description)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		strings.TrimSpace(req.RouteNumber),
		strings.TrimSpace(req.BusNumber),
		strings.TrimSpace(req.Description),
	).Scan(&routeID)
	if err != nil {
		log.Printf("failed to insert route: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create route",
		})
	}

	// Insert stops for this route. We keep it simple (no explicit transaction),
	// but log any insertion errors.
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
		if _, err := database.Exec(
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

	// TODO: Verify user is bus_owner
	// TODO: Create audit log

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"route": fiber.Map{
			"id":           routeID,
			"route_number": strings.TrimSpace(req.RouteNumber),
			"bus_number":   strings.TrimSpace(req.BusNumber),
			"description":  strings.TrimSpace(req.Description),
			"stops":        req.Stops,
		},
	})
}

// GetRoutes retrieves all routes
func GetRoutes(c *fiber.Ctx) error {
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

	offset := (page - 1) * limit

	// Query routes from database (newest first)
	rows, err := database.Query(
		`SELECT id, route_number, bus_number, description
		 FROM routes
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

	type RouteResponse struct {
		ID          string         `json:"id"`
		RouteNumber string         `json:"route_number"`
		BusNumber   string         `json:"bus_number"`
		Description string         `json:"description"`
		Stops       []StopResponse `json:"stops"`
	}

	routes := []RouteResponse{}
	for rows.Next() {
		var r RouteResponse
		if err := rows.Scan(&r.ID, &r.RouteNumber, &r.BusNumber, &r.Description); err != nil {
			log.Printf("failed to scan route row: %v", err)
			continue
		}

		// Load stops for this route
		stopRows, err := database.Query(
			`SELECT stop_name, distance_km, amount
			 FROM stops
			 WHERE route_id = $1
			 ORDER BY sequence_order ASC`,
			r.ID,
		)
		if err != nil {
			log.Printf("failed to query stops for route %s: %v", r.ID, err)
		} else {
			for stopRows.Next() {
				var name string
				var distance sql.NullFloat64
				var amount sql.NullFloat64
				if err := stopRows.Scan(&name, &distance, &amount); err != nil {
					log.Printf("failed to scan stop for route %s: %v", r.ID, err)
					continue
				}
				if trimmed := strings.TrimSpace(name); trimmed != "" {
					stop := StopResponse{Name: trimmed}
					if distance.Valid {
						v := distance.Float64
						stop.DistanceKm = &v
					}
					if amount.Valid {
						v := amount.Float64
						stop.Amount = &v
					}
					r.Stops = append(r.Stops, stop)
				}
			}
			stopRows.Close()
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
	_ = c.Params("routeId")

	// TODO: Query route from database
	// TODO: Include stops
	// TODO: Return route details

	return c.JSON(fiber.Map{
		"route": fiber.Map{},
	})
}

// UpdateRoute updates a route
func UpdateRoute(c *fiber.Ctx) error {
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

	// Update route details
	_, err := database.Exec(
		`UPDATE routes
		 SET route_number = $1,
		     bus_number = $2,
		     description = $3,
		     updated_at = NOW()
		 WHERE id = $4`,
		strings.TrimSpace(req.RouteNumber),
		strings.TrimSpace(req.BusNumber),
		strings.TrimSpace(req.Description),
		routeID,
	)
	if err != nil {
		log.Printf("failed to update route %s: %v", routeID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update route",
		})
	}

	// Replace existing stops
	if _, err := database.Exec(`DELETE FROM stops WHERE route_id = $1`, routeID); err != nil {
		log.Printf("failed to delete stops for route %s: %v", routeID, err)
	}

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

		if _, err := database.Exec(
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

	// TODO: Verify user is bus_owner who created this route
	// TODO: Create audit log

	return c.JSON(fiber.Map{
		"success": true,
		"route": fiber.Map{
			"id":           routeID,
			"route_number": strings.TrimSpace(req.RouteNumber),
			"bus_number":   strings.TrimSpace(req.BusNumber),
			"description":  strings.TrimSpace(req.Description),
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
	_ = c.Params("routeId")

	// TODO: Verify user is bus_owner who created this route
	// TODO: Delete route from database
	// TODO: Delete associated stops
	// TODO: Create audit log

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Route deleted successfully",
	})
}
