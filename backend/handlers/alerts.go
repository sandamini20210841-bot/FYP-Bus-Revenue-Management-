package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// TriggerAlert sends an alert to bus owner
func TriggerAlert(c *fiber.Ctx) error {
	_ = c.Params("id")

	type TriggerAlertRequest struct {
		AlertMessage string `json:"alert_message" validate:"required"`
	}

	var req TriggerAlertRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Fetch discrepancy
	// TODO: Get bus owner contact info
	// TODO: Send in-app notification
	// TODO: Queue for email/SMS if enabled
	// TODO: Create notification log in MongoDB
	// TODO: Return confirmation

	return c.JSON(fiber.Map{
		"success": true,
		"alertId": "alert-uuid",
		"sent":    true,
	})
}
