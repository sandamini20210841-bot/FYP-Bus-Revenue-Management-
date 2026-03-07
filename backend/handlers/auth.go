package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// Register creates a new user account
func Register(c *fiber.Ctx) error {
	type RegisterRequest struct {
		Email       string `json:"email" validate:"required,email"`
		Password    string `json:"password" validate:"required,min=8"`
		FullName    string `json:"full_name" validate:"required"`
		PhoneNumber string `json:"phone_number" validate:"required"`
		UserType    string `json:"user_type" validate:"required"` // rider, bus_owner, accountant
	}

	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Validate input
	// TODO: Hash password
	// TODO: Create user in database
	// TODO: Send OTP via SMS
	// TODO: Return userId and requiresOtpVerification

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":                   true,
		"message":                   "OTP sent to phone number",
		"userId":                    "user-uuid",
		"requiresOtpVerification":   true,
	})
}

// VerifyOTP verifies the OTP and creates the user account
func VerifyOTP(c *fiber.Ctx) error {
	type VerifyOTPRequest struct {
		UserID      string `json:"user_id" validate:"required"`
		OTP         string `json:"otp" validate:"required,len=6"`
		PhoneNumber string `json:"phone_number" validate:"required"`
	}

	var req VerifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Verify OTP against cached value
	// TODO: Create user in database
	// TODO: Generate JWT tokens
	// TODO: Return tokens

	return c.JSON(fiber.Map{
		"success":      true,
		"message":      "User account created successfully",
		"token":        "jwt_token",
		"refreshToken": "refresh_token",
	})
}

// Login authenticates a user with email and password
func Login(c *fiber.Ctx) error {
	type LoginRequest struct {
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required"`
	}

	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Find user by email
	// TODO: Verify password
	// TODO: Generate JWT tokens
	// TODO: Update last_login timestamp
	// TODO: Return tokens and user

	return c.JSON(fiber.Map{
		"success": true,
		"token":   "jwt_token",
		"refreshToken": "refresh_token",
		"user": fiber.Map{
			"id": "user-uuid",
			"email": "user@example.com",
			"fullName": "John Doe",
			"role": "rider",
		},
	})
}

// RefreshToken refreshes JWT token using refresh token
func RefreshToken(c *fiber.Ctx) error {
	type RefreshTokenRequest struct {
		RefreshToken string `json:"refreshToken" validate:"required"`
	}

	var req RefreshTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Validate refresh token
	// TODO: Generate new JWT token
	// TODO: Optionally rotate refresh token

	return c.JSON(fiber.Map{
		"success": true,
		"token":   "new_jwt_token",
		"refreshToken": "new_refresh_token",
	})
}

// Logout clears user session
func Logout(c *fiber.Ctx) error {
	// TODO: Invalidate tokens (add to blacklist if using Redis)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Logged out successfully",
	})
}
