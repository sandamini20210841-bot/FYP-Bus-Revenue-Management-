package handlers

import (
	"database/sql"
	"time"

	"github.com/busticket/backend/database"
	"github.com/busticket/backend/models"
	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// GetUser retrieves user profile
func GetUser(c *fiber.Ctx) error {
	userIDClaim, _ := c.Locals("userId").(string)
	if userIDClaim == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user in context",
		})
	}

	var user models.User
	err := database.QueryRow(
		"SELECT id, email, phone_number, full_name, role, COALESCE(profile_photo_url, ''), created_at, updated_at, last_login, public_id FROM users WHERE id = $1",
		userIDClaim,
	).Scan(
		&user.ID,
		&user.Email,
		&user.PhoneNumber,
		&user.FullName,
		&user.Role,
		&user.ProfilePhotoURL,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.LastLogin,
		&user.PublicID,
	)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "User not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load user profile",
		})
	}

	return c.JSON(fiber.Map{
		"user": user,
	})
}

// ChangePassword allows the authenticated user to change their password
func ChangePassword(c *fiber.Ctx) error {
	userIDClaim, _ := c.Locals("userId").(string)
	if userIDClaim == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user in context",
		})
	}

	type ChangePasswordRequest struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}

	var req ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if len(req.NewPassword) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "New password must be at least 8 characters",
		})
	}

	// Load existing password hash
	var passwordHash string
	err := database.QueryRow("SELECT password_hash FROM users WHERE id = $1", userIDClaim).Scan(&passwordHash)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "User not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load user",
		})
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.CurrentPassword)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Current password is incorrect",
		})
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to secure password",
		})
	}

	// Update password
	_, err = database.Exec("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", string(newHash), time.Now(), userIDClaim)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update password",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Password updated successfully",
	})
}

// UpdateUser updates user profile
func UpdateUser(c *fiber.Ctx) error {
	userIDClaim, _ := c.Locals("userId").(string)
	if userIDClaim == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user in context",
		})
	}

	type UpdateUserRequest struct {
		FullName        string `json:"full_name"`
		PhoneNumber     string `json:"phone_number"`
		Email           string `json:"email"`
		ProfilePhotoURL string `json:"profile_photo_url"`
	}

	var req UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Email == "" || req.FullName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email and full_name are required",
		})
	}

	var user models.User
	err := database.QueryRow(
		"UPDATE users SET email = $2, phone_number = $3, full_name = $4, profile_photo_url = $5, updated_at = NOW() WHERE id = $1 RETURNING id, email, phone_number, full_name, role, COALESCE(profile_photo_url, ''), created_at, updated_at, last_login, public_id",
		userIDClaim,
		req.Email,
		req.PhoneNumber,
		req.FullName,
		req.ProfilePhotoURL,
	).Scan(
		&user.ID,
		&user.Email,
		&user.PhoneNumber,
		&user.FullName,
		&user.Role,
		&user.ProfilePhotoURL,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.LastLogin,
		&user.PublicID,
	)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "User not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update user",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"user": user,
	})
}

// GetUserTransactions retrieves all transactions for a user
func GetUserTransactions(c *fiber.Ctx) error {
	_ = c.Params("userId")
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)

	// TODO: Verify authorization
	// TODO: Query transactions from database
	// TODO: Apply pagination
	// TODO: Return transaction list

	return c.JSON(fiber.Map{
		"transactions": []fiber.Map{},
		"pagination": fiber.Map{
			"page": page,
			"limit": limit,
			"total": 0,
		},
	})
}
