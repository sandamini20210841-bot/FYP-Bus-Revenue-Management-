package middleware

import (
	"log"

	"github.com/gofiber/fiber/v2"
)

// Logger middleware logs all requests
func Logger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		log.Printf("%s %s %d", c.Method(), c.Path(), c.Response().StatusCode())
		return c.Next()
	}
}

// ErrorHandler handles errors consistently
func ErrorHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.Next()
	}
}

// AuthRequired middleware verifies JWT token
func AuthRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: Extract JWT from Authorization header
		// TODO: Verify token signature
		// TODO: Check token expiration
		// TODO: Extract user info and store in context
		// TODO: Return 401 if invalid

		return c.Next()
	}
}

// RoleRequired middleware checks user role
func RoleRequired(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: Get user from context
		// TODO: Check if user role is in allowedRoles
		// TODO: Return 403 if not allowed

		return c.Next()
	}
}

// AuditLog middleware logs sensitive operations
func AuditLog() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: Log user action to MongoDB
		// TODO: Include method, path, user_id, timestamp, ip_address

		return c.Next()
	}
}

// RateLimit middleware limits requests
func RateLimit() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: Implement rate limiting logic
		// TODO: Check request count per IP
		// TODO: Return 429 if exceeded

		return c.Next()
	}
}
