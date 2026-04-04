package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/smtp"
	"strings"
	"time"

	"github.com/busticket/backend/config"
	"github.com/busticket/backend/database"
	"github.com/busticket/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

const userIDCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func generatePublicUserID() (string, error) {
	length := 10
	b := make([]byte, length)
	for i := 0; i < length; i++ {
		max := big.NewInt(int64(len(userIDCharset)))
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = userIDCharset[n.Int64()]
	}
	return string(b), nil
}

func generateResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func sendResetEmail(toEmail, token string) error {
	cfg := config.LoadConfig()
	if cfg.SMTPHost == "" || cfg.SMTPEmail == "" || cfg.SMTPPassword == "" {
		log.Printf("SMTP not configured; skipping email send for %s", toEmail)
		return nil
	}

	from := cfg.SMTPEmail
	subject := "Password reset instructions"
	body := fmt.Sprintf("You requested a password reset. Use the following token to reset your password: %s\n\nIf you did not request this, you can ignore this email.", token)

	msg := []byte("From: " + from + "\r\n" +
		"To: " + toEmail + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=\"utf-8\"\r\n" +
		"\r\n" +
		body + "\r\n")

	auth := smtp.PlainAuth("", cfg.SMTPEmail, cfg.SMTPPassword, cfg.SMTPHost)
	addr := cfg.SMTPHost + ":" + cfg.SMTPPort
	if err := smtp.SendMail(addr, auth, from, []string{toEmail}, msg); err != nil {
		log.Printf("Failed to send reset email to %s: %v", toEmail, err)
		return err
	}

	return nil
}

// Register creates a new user account
func Register(c *fiber.Ctx) error {
	type RegisterRequest struct {
		Email       string `json:"email" validate:"required,email"`
		Password    string `json:"password" validate:"required,min=8"`
		FullName    string `json:"full_name" validate:"required"`
		PhoneNumber string `json:"phone_number" validate:"required"`
		UserType    string `json:"user_type" validate:"required"` // rider, bus_owner, accountant
		Portal      string `json:"portal"`
	}

	var req RegisterRequest
	body := c.Body()
	log.Printf("Register raw body: %s", string(body))
	if err := json.Unmarshal(body, &req); err != nil {
		log.Printf("Register JSON error: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Password == "" || req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email and password are required",
		})
	}

	if strings.EqualFold(strings.TrimSpace(req.Portal), "backoffice") && strings.EqualFold(strings.TrimSpace(req.UserType), "rider") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	// Generate a unique 10-character public ID
	var publicID string
	for attempts := 0; attempts < 5; attempts++ {
		candidate, err := generatePublicUserID()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to generate user id",
			})
		}

		var existing string
		checkErr := database.QueryRow("SELECT id FROM users WHERE public_id = $1", candidate).Scan(&existing)
		if checkErr == sql.ErrNoRows {
			publicID = candidate
			break
		}
		if checkErr != nil && checkErr != sql.ErrNoRows {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to check existing user id",
			})
		}
	}
	if publicID == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Could not allocate user id",
		})
	}

	// Check if user already exists
	var existingID string
	err := database.QueryRow("SELECT id FROM users WHERE email = $1", req.Email).Scan(&existingID)
	if err == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "this email already registered in the platform",
		})
	}
	if err != nil && err != sql.ErrNoRows {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to check existing user",
		})
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to secure password",
		})
	}

	// Create user
	var user models.User
	err = database.QueryRow(
		"INSERT INTO users (email, phone_number, full_name, role, password_hash, public_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, phone_number, full_name, role, COALESCE(profile_photo_url, ''), created_at, updated_at, public_id",
		req.Email,
		req.PhoneNumber,
		req.FullName,
		req.UserType,
		string(passwordHash),
		publicID,
	).Scan(
		&user.ID,
		&user.Email,
		&user.PhoneNumber,
		&user.FullName,
		&user.Role,
		&user.ProfilePhotoURL,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.PublicID,
	)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "this email already registered in the platform",
			})
		}
		log.Printf("Register insert error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create user",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Account created successfully",
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
		Portal   string `json:"portal"`
	}

	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	var user models.User
	var passwordHash string
	err := database.QueryRow(
		"SELECT id, email, phone_number, full_name, role, password_hash, COALESCE(profile_photo_url, ''), public_id FROM users WHERE email = $1 AND is_active = TRUE",
		req.Email,
	).Scan(
		&user.ID,
		&user.Email,
		&user.PhoneNumber,
		&user.FullName,
		&user.Role,
		&passwordHash,
		&user.ProfilePhotoURL,
		&user.PublicID,
	)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Account not found for this email",
		})
	}
	if err != nil {
		log.Printf("Login query error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to find user",
		})
	}

	// Ensure user has a valid 10-character public ID (for older accounts)
	if len(user.PublicID) != 10 {
		var publicID string
		for attempts := 0; attempts < 5; attempts++ {
			candidate, genErr := generatePublicUserID()
			if genErr != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "Failed to generate user id",
				})
			}

			var existing string
			checkErr := database.QueryRow("SELECT id FROM users WHERE public_id = $1", candidate).Scan(&existing)
			if checkErr == sql.ErrNoRows {
				publicID = candidate
				break
			}
			if checkErr != nil && checkErr != sql.ErrNoRows {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "Failed to check existing user id",
				})
			}
		}

		if publicID == "" {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Could not allocate user id",
			})
		}

		if _, updErr := database.Exec("UPDATE users SET public_id = $1 WHERE id = $2", publicID, user.ID); updErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to persist user id",
			})
		}

		user.PublicID = publicID
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid email or password",
		})
	}

	if strings.EqualFold(strings.TrimSpace(req.Portal), "backoffice") && strings.EqualFold(strings.TrimSpace(user.Role), "rider") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	// Generate JWT tokens
	cfg := config.LoadConfig()
	accessTokenExpiry := time.Now().Add(time.Duration(cfg.JWTExpiration) * time.Second)
	refreshTokenExpiry := time.Now().Add(time.Duration(cfg.RefreshExpiration) * time.Second)

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"exp":   accessTokenExpiry.Unix(),
	})
	accessTokenString, err := accessToken.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate token",
		})
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID,
		"exp": refreshTokenExpiry.Unix(),
		"typ": "refresh",
	})
	refreshTokenString, err := refreshToken.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate refresh token",
		})
	}

	// Update last_login
	_, _ = database.Exec("UPDATE users SET last_login = NOW() WHERE id = $1", user.ID)

	// Record successful login in audit logs.
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

	loginPortal := strings.TrimSpace(req.Portal)
	if loginPortal == "" {
		loginPortal = "default"
	}
	_, _ = database.Exec(
		`INSERT INTO audit_logs (user_id, action, resource, details, ip_address)
		 VALUES ($1, $2, $3, $4, $5)`,
		user.ID,
		"login",
		"auth",
		fmt.Sprintf("Successful login via %s portal", loginPortal),
		c.IP(),
	)

	return c.JSON(fiber.Map{
		"success":      true,
		"token":        accessTokenString,
		"refreshToken": refreshTokenString,
		"user": fiber.Map{
			"id":       user.PublicID,
			"email":    user.Email,
			"fullName": user.FullName,
			"role":     user.Role,
		},
	})
}

// ForgotPassword starts the password reset flow by generating a reset token
func ForgotPassword(c *fiber.Ctx) error {
	type ForgotPasswordRequest struct {
		Email string `json:"email"`
	}

	var req ForgotPasswordRequest
	body := c.Body()
	if err := json.Unmarshal(body, &req); err != nil || req.Email == "" {
		log.Printf("ForgotPassword JSON error: %v, body: %s", err, string(body))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	var userID string
	err := database.QueryRow("SELECT id FROM users WHERE email = $1 AND is_active = TRUE", req.Email).Scan(&userID)
	if err == sql.ErrNoRows {
		// Do not reveal whether the email exists
		return c.JSON(fiber.Map{
			"success": true,
			"message": "If an account exists for this email, password reset instructions have been sent.",
		})
	}
	if err != nil {
		log.Printf("ForgotPassword query error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to process request",
		})
	}

	token, err := generateResetToken()
	if err != nil {
		log.Printf("Failed to generate reset token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to process request",
		})
	}

	expiresAt := time.Now().Add(15 * time.Minute)
	_, err = database.Exec(
		"INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID,
		token,
		expiresAt,
	)
	if err != nil {
		log.Printf("Failed to store reset token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to process request",
		})
	}

	// Send reset email (best-effort)
	if err := sendResetEmail(req.Email, token); err != nil {
		// Still respond 200 so we don't leak account existence or SMTP issues
		log.Printf("ForgotPassword: email send failed for %s: %v", req.Email, err)
	}

	// Also log token for development/testing
	log.Printf("Password reset token for %s: %s", req.Email, token)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "If an account exists for this email, password reset instructions have been sent.",
	})
}

// ResetPassword completes the password reset using a valid token
func ResetPassword(c *fiber.Ctx) error {
	type ResetPasswordRequest struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}

	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil || req.Token == "" || req.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	var userID string
	err := database.QueryRow(
		"SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
		req.Token,
	).Scan(&userID)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid or expired reset token",
		})
	}
	if err != nil {
		log.Printf("ResetPassword token lookup error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to reset password",
		})
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to secure password",
		})
	}

	_, err = database.Exec("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", string(passwordHash), userID)
	if err != nil {
		log.Printf("ResetPassword update user error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to reset password",
		})
	}

	_, err = database.Exec("UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = $1", req.Token)
	if err != nil {
		log.Printf("ResetPassword mark token used error: %v", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Password has been reset successfully",
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
		"success":      true,
		"token":        "new_jwt_token",
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
