package middleware

import (
	"log"
	"strings"

	"github.com/busticket/backend/config"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
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
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing Authorization header",
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid Authorization header format",
			})
		}

		tokenString := parts[1]
		cfg := config.LoadConfig()

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(fiber.StatusUnauthorized, "Unexpected signing method")
			}
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Locals("userId", claims["sub"])
			c.Locals("userEmail", claims["email"])
			c.Locals("userRole", claims["role"])
		}

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
