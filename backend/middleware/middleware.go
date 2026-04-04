package middleware

import (
	"fmt"
	"log"
	"strings"

	"github.com/busticket/backend/database"

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
		err := c.Next()

		// Only audit successful mutating actions.
		if c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead || c.Method() == fiber.MethodOptions {
			return err
		}
		if c.Response().StatusCode() >= 400 {
			return err
		}

		action := "update"
		switch c.Method() {
		case fiber.MethodPost:
			action = "create"
		case fiber.MethodPut, fiber.MethodPatch:
			action = "edit"
		case fiber.MethodDelete:
			action = "delete"
		}

		path := c.Path()
		resource := "system"
		parts := strings.Split(strings.Trim(path, "/"), "/")
		if len(parts) >= 3 {
			resource = parts[2]
		} else if len(parts) > 0 && parts[0] != "" {
			resource = parts[len(parts)-1]
		}

		userID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))
		if userID == "" || userID == "<nil>" {
			userID = ""
		}

		details := buildAuditDetails(c.Method(), path, resource)
		ipAddress := c.IP()

		_, _ = database.Exec(
			`CREATE TABLE IF NOT EXISTS audit_logs (
			  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
			  action VARCHAR(50) NOT NULL,
			  resource VARCHAR(100),
			  details TEXT,
			  ip_address VARCHAR(64),
			  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)`,
		)

		if userID == "" {
			_, _ = database.Exec(
				`INSERT INTO audit_logs (action, resource, details, ip_address)
				 VALUES ($1, $2, $3, $4)`,
				action,
				resource,
				details,
				ipAddress,
			)
			return err
		}

		_, _ = database.Exec(
			`INSERT INTO audit_logs (user_id, action, resource, details, ip_address)
			 VALUES ($1, $2, $3, $4, $5)`,
			userID,
			action,
			resource,
			details,
			ipAddress,
		)

		return err
	}
}

func buildAuditDetails(method string, path string, resource string) string {
	methodLower := strings.ToLower(strings.TrimSpace(method))
	resourceLabel := strings.ReplaceAll(strings.TrimSpace(resource), "_", " ")
	if resourceLabel == "" {
		resourceLabel = "record"
	}

	hasID := false
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) >= 4 {
		last := strings.TrimSpace(parts[len(parts)-1])
		if last != "" && last != "access" {
			hasID = true
		}
	}

	if strings.Contains(path, "/access") && resource == "users" && (methodLower == "put" || methodLower == "patch") {
		return "Updated user access"
	}

	switch methodLower {
	case "post":
		return fmt.Sprintf("Created %s", resourceLabel)
	case "put", "patch":
		if hasID {
			return fmt.Sprintf("Edited %s", singularize(resourceLabel))
		}
		return fmt.Sprintf("Edited %s", resourceLabel)
	case "delete":
		if hasID {
			return fmt.Sprintf("Deleted %s", singularize(resourceLabel))
		}
		return fmt.Sprintf("Deleted %s", resourceLabel)
	default:
		return fmt.Sprintf("%s %s", strings.ToUpper(method), path)
	}
}

func singularize(label string) string {
	trimmed := strings.TrimSpace(label)
	if strings.HasSuffix(trimmed, "s") && len(trimmed) > 1 {
		return trimmed[:len(trimmed)-1]
	}
	return trimmed
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
