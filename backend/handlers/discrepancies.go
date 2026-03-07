package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// GetDiscrepancies retrieves discrepancies with optional filters
func GetDiscrepancies(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	_ = c.Query("status")
	_ = c.Query("routeNumber")
	_ = c.Query("busNumber")
	_ = c.Query("dateFrom")
	_ = c.Query("dateTo")

	// TODO: Verify user is accountant
	// TODO: Query discrepancies from database
	// TODO: Apply filters
	// TODO: Apply pagination
	// TODO: Return list

	return c.JSON(fiber.Map{
		"discrepancies": []fiber.Map{},
		"pagination": fiber.Map{
			"page": page,
			"limit": limit,
			"total": 0,
		},
	})
}

// GetDiscrepancy retrieves a specific discrepancy
func GetDiscrepancy(c *fiber.Ctx) error {
	_ = c.Params("id")

	// TODO: Query discrepancy from database
	// TODO: Include expected vs actual revenue
	// TODO: Include trip information
	// TODO: Return details

	return c.JSON(fiber.Map{
		"discrepancy": fiber.Map{},
	})
}

// UpdateDiscrepancyStatus updates the status of a discrepancy
func UpdateDiscrepancyStatus(c *fiber.Ctx) error {
	_ = c.Params("id")

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

	// TODO: Verify user is accountant
	// TODO: Update status in database
	// TODO: Create audit log
	// TODO: Trigger alert if status changed

	return c.JSON(fiber.Map{
		"success": true,
		"discrepancy": fiber.Map{},
	})
}

// GetDiscrepancyStats retrieves discrepancy statistics
func GetDiscrepancyStats(c *fiber.Ctx) error {
	// TODO: Count total discrepancies
	// TODO: Group by status
	// TODO: Group by route
	// TODO: Calculate total loss

	return c.JSON(fiber.Map{
		"totalDiscrepancies": 0,
		"byStatus": fiber.Map{},
		"byRoute": fiber.Map{},
	})
}
