package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// GetTransactions retrieves all transactions
func GetTransactions(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	_ = c.Query("userId")
	_ = c.Query("dateFrom")
	_ = c.Query("dateTo")
	_ = c.Query("status")

	// TODO: Query transactions from database
	// TODO: Apply filters
	// TODO: Apply pagination
	// TODO: Return list

	return c.JSON(fiber.Map{
		"transactions": []fiber.Map{},
		"pagination": fiber.Map{
			"page": page,
			"limit": limit,
			"total": 0,
		},
	})
}
