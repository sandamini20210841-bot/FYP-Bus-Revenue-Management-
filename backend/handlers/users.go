package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/busticket/backend/database"
	"github.com/busticket/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var allowedAccessModules = []string{
	"dashboard",
	"discrepancies",
	"routes",
	"buses",
	"summary",
	"timetable",
	"reports",
	"users",
	"audit_logs",
}

func isAdmin(c *fiber.Ctx) bool {
	roleClaim, _ := c.Locals("userRole").(string)
	return normalizeRole(roleClaim) == "admin"
}

func isBackofficeViewer(c *fiber.Ctx) bool {
	roleClaim, _ := c.Locals("userRole").(string)
	role := normalizeRole(roleClaim)
	return role == "admin" || role == "bus_owner" || role == "accountant" || role == "time_keeper"
}

func normalizeRole(rawRole string) string {
	role := strings.TrimSpace(strings.ToLower(rawRole))
	role = strings.ReplaceAll(role, "-", "_")
	role = strings.ReplaceAll(role, " ", "_")
	return role
}

func resolveUserUUIDByPublicID(publicID string) (string, error) {
	var userUUID string
	err := database.QueryRow(
		`SELECT id
		 FROM users
		 WHERE (public_id = $1 OR id::text = $1)
		   AND REPLACE(REPLACE(LOWER(TRIM(role)), ' ', '_'), '-', '_') IN ('admin', 'bus_owner', 'accountant', 'time_keeper')`,
		publicID,
	).Scan(&userUUID)
	if err != nil {
		return "", err
	}
	return userUUID, nil
}

type accessPermissionState struct {
	canCreate bool
	canView   bool
	canEdit   bool
	canDelete bool
}

func roleDefaultPermissions(role string) map[string]accessPermissionState {
	defaults := map[string]accessPermissionState{}

	switch normalizeRole(role) {
	case "admin":
		for _, module := range allowedAccessModules {
			defaults[module] = accessPermissionState{canCreate: true, canView: true, canEdit: true, canDelete: true}
		}
	case "bus_owner":
		for _, module := range []string{"dashboard", "discrepancies", "summary", "reports"} {
			defaults[module] = accessPermissionState{canCreate: false, canView: true, canEdit: false, canDelete: false}
		}
		defaults["buses"] = accessPermissionState{canCreate: true, canView: true, canEdit: true, canDelete: true}
		defaults["routes"] = accessPermissionState{canCreate: false, canView: true, canEdit: false, canDelete: false}
	case "time_keeper":
		defaults["routes"] = accessPermissionState{canCreate: true, canView: true, canEdit: true, canDelete: false}
		defaults["buses"] = accessPermissionState{canCreate: true, canView: true, canEdit: true, canDelete: false}
		defaults["summary"] = accessPermissionState{canCreate: false, canView: true, canEdit: false, canDelete: false}
		defaults["timetable"] = accessPermissionState{canCreate: true, canView: true, canEdit: true, canDelete: true}
	case "accountant":
		defaults["dashboard"] = accessPermissionState{canCreate: false, canView: true, canEdit: true, canDelete: true}
		defaults["discrepancies"] = accessPermissionState{canCreate: false, canView: true, canEdit: true, canDelete: true}
		defaults["routes"] = accessPermissionState{canCreate: false, canView: true, canEdit: false, canDelete: false}
		defaults["summary"] = accessPermissionState{canCreate: false, canView: true, canEdit: false, canDelete: false}
		defaults["reports"] = accessPermissionState{canCreate: false, canView: true, canEdit: true, canDelete: true}
	}

	return defaults
}

func resetUserPermissionsToRoleDefaults(tx *sql.Tx, userUUID string, role string) error {
	if _, err := tx.Exec(`DELETE FROM user_access_permissions WHERE user_id = $1`, userUUID); err != nil {
		return err
	}

	roleDefaults := roleDefaultPermissions(role)
	for _, module := range allowedAccessModules {
		state, ok := roleDefaults[module]
		if !ok {
			state = accessPermissionState{}
		}

		if _, err := tx.Exec(
			`INSERT INTO user_access_permissions (user_id, module_name, can_create, can_view, can_edit, can_delete)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			userUUID,
			module,
			state.canCreate,
			state.canView,
			state.canEdit,
			state.canDelete,
		); err != nil {
			return err
		}
	}

	return nil
}

func buildUserAccessPermissions(userUUID string, role string) ([]fiber.Map, error) {
	rows, err := database.Query(
		`SELECT module_name, can_create, can_view, can_edit, can_delete
		 FROM user_access_permissions
		 WHERE user_id = $1`,
		userUUID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	permissionMap := map[string]accessPermissionState{}
	for rows.Next() {
		var module string
		var canCreate bool
		var canView bool
		var canEdit bool
		var canDelete bool
		if err := rows.Scan(&module, &canCreate, &canView, &canEdit, &canDelete); err != nil {
			continue
		}
		permissionMap[module] = accessPermissionState{
			canCreate: canCreate,
			canView:   canView,
			canEdit:   canEdit,
			canDelete: canDelete,
		}
	}

	roleDefaults := roleDefaultPermissions(role)

	permissions := make([]fiber.Map, 0, len(allowedAccessModules))
	for _, module := range allowedAccessModules {
		state, hasExplicit := permissionMap[module]
		if !hasExplicit {
			if defaultState, ok := roleDefaults[module]; ok {
				state = defaultState
			} else {
				state = accessPermissionState{}
			}
		}

		permissions = append(permissions, fiber.Map{
			"module_name": module,
			"can_create":  state.canCreate,
			"can_view":    state.canView,
			"can_edit":    state.canEdit,
			"can_delete":  state.canDelete,
		})
	}

	return permissions, nil
}

// GetMyAccess retrieves module-level permissions for the authenticated back-office user.
func GetMyAccess(c *fiber.Ctx) error {
	if !isBackofficeViewer(c) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	userID, _ := c.Locals("userId").(string)
	if strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user in context",
		})
	}

	roleClaim, _ := c.Locals("userRole").(string)
	permissions, err := buildUserAccessPermissions(userID, roleClaim)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load user access",
		})
	}

	return c.JSON(fiber.Map{
		"permissions": permissions,
	})
}

// DeleteUser deletes a back-office user account (admin only).
func DeleteUser(c *fiber.Ctx) error {
	if !isAdmin(c) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	publicUserID := strings.TrimSpace(c.Params("userId"))
	if publicUserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "userId is required",
		})
	}

	targetUserUUID, err := resolveUserUUIDByPublicID(publicUserID)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "User not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to resolve user",
		})
	}

	actorUserUUID, _ := c.Locals("userId").(string)
	if strings.TrimSpace(actorUserUUID) != "" && strings.EqualFold(strings.TrimSpace(actorUserUUID), strings.TrimSpace(targetUserUUID)) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "You cannot delete your own account",
		})
	}

	res, err := database.Exec(`DELETE FROM users WHERE id = $1`, targetUserUUID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete user",
		})
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "User not found",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "User deleted successfully",
	})
}

// CreateUser creates a new back-office user account (admin only).
func CreateUser(c *fiber.Ctx) error {
	if !isAdmin(c) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	type CreateUserRequest struct {
		FullName    string `json:"full_name"`
		Email       string `json:"email"`
		PhoneNumber string `json:"phone_number"`
		Role        string `json:"role"`
	}

	var req CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	fullName := strings.TrimSpace(req.FullName)
	email := strings.TrimSpace(strings.ToLower(req.Email))
	phoneNumber := strings.TrimSpace(req.PhoneNumber)
	role := normalizeRole(req.Role)

	if fullName == "" || email == "" || role == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "full_name, email and role are required",
		})
	}

	if role != "admin" && role != "bus_owner" && role != "accountant" && role != "time_keeper" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid role for back-office user",
		})
	}

	var existingUserID string
	err := database.QueryRow(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, email).Scan(&existingUserID)
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

	publicID := ""
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
				"error": "Failed to check generated user id",
			})
		}
	}

	if publicID == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Could not allocate user id",
		})
	}

	// Temporary default password for admin-created users.
	tempPassword := "ChangeMe123!"
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to secure password",
		})
	}

	var user models.User
	err = database.QueryRow(
		`INSERT INTO users (public_id, email, phone_number, full_name, role, password_hash)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, email, phone_number, full_name, role, COALESCE(profile_photo_url, ''), created_at, updated_at, public_id`,
		publicID,
		email,
		phoneNumber,
		fullName,
		role,
		string(passwordHash),
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create user",
		})
	}

	tx, txErr := database.PostgresDB.Begin()
	if txErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to initialize user access permissions",
		})
	}
	defer tx.Rollback()

	if permErr := resetUserPermissionsToRoleDefaults(tx, user.ID, role); permErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to initialize user access permissions",
		})
	}

	if commitErr := tx.Commit(); commitErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to finalize user access permissions",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":           true,
		"message":           "User created successfully",
		"temporaryPassword": tempPassword,
		"user": fiber.Map{
			"id":           user.PublicID,
			"full_name":    user.FullName,
			"email":        user.Email,
			"phone_number": user.PhoneNumber,
			"role":         user.Role,
			"is_active":    true,
			"created_at":   user.CreatedAt,
		},
	})
}

// GetUsers retrieves back-office users for admin view.
func GetUsers(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}
	offset := (page - 1) * limit

	rows, err := database.Query(
		`SELECT COALESCE(NULLIF(public_id, ''), id::text), email, COALESCE(full_name, ''), COALESCE(phone_number, ''), role, is_active, created_at, last_login
		 FROM users
		 WHERE REPLACE(REPLACE(LOWER(TRIM(role)), ' ', '_'), '-', '_') IN ('admin', 'bus_owner', 'accountant', 'time_keeper')
		 ORDER BY created_at DESC
		 LIMIT $1 OFFSET $2`,
		limit,
		offset,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load users",
		})
	}
	defer rows.Close()

	users := []fiber.Map{}
	for rows.Next() {
		var publicID string
		var email string
		var fullName string
		var phoneNumber string
		var role string
		var isActive bool
		var createdAt time.Time
		var lastLogin sql.NullTime

		if err := rows.Scan(&publicID, &email, &fullName, &phoneNumber, &role, &isActive, &createdAt, &lastLogin); err != nil {
			continue
		}

		var lastLoginValue interface{}
		if lastLogin.Valid {
			lastLoginValue = lastLogin.Time
		} else {
			lastLoginValue = nil
		}

		users = append(users, fiber.Map{
			"id":           publicID,
			"email":        email,
			"full_name":    fullName,
			"phone_number": phoneNumber,
			"role":         role,
			"is_active":    isActive,
			"created_at":   createdAt,
			"last_login":   lastLoginValue,
		})
	}

	var total int
	if err := database.QueryRow(`SELECT COUNT(*) FROM users WHERE REPLACE(REPLACE(LOWER(TRIM(role)), ' ', '_'), '-', '_') IN ('admin', 'bus_owner', 'accountant', 'time_keeper')`).Scan(&total); err != nil {
		total = len(users)
	}

	return c.JSON(fiber.Map{
		"users": users,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetUserAccess retrieves module-level view/edit permissions for a specific back-office user.
func GetUserAccess(c *fiber.Ctx) error {
	if !isAdmin(c) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	publicUserID := strings.TrimSpace(c.Params("userId"))
	if publicUserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "userId is required",
		})
	}

	userUUID, err := resolveUserUUIDByPublicID(publicUserID)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "User not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to resolve user",
		})
	}

	var userRole string
	if err := database.QueryRow(`SELECT role FROM users WHERE id = $1`, userUUID).Scan(&userRole); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to resolve user role",
		})
	}

	permissions, err := buildUserAccessPermissions(userUUID, userRole)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load user access",
		})
	}

	return c.JSON(fiber.Map{
		"user_id":     publicUserID,
		"permissions": permissions,
	})
}

// UpdateUserAccess updates module-level view/edit permissions for a specific back-office user.
func UpdateUserAccess(c *fiber.Ctx) error {
	if !isAdmin(c) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	type AccessItem struct {
		ModuleName string `json:"module_name"`
		CanCreate  bool   `json:"can_create"`
		CanView    bool   `json:"can_view"`
		CanEdit    bool   `json:"can_edit"`
		CanDelete  bool   `json:"can_delete"`
	}
	type UpdateUserAccessRequest struct {
		Permissions []AccessItem `json:"permissions"`
	}

	publicUserID := strings.TrimSpace(c.Params("userId"))
	if publicUserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "userId is required",
		})
	}

	var req UpdateUserAccessRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if len(req.Permissions) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "permissions are required",
		})
	}

	allowedMap := map[string]bool{}
	for _, module := range allowedAccessModules {
		allowedMap[module] = true
	}

	for _, permission := range req.Permissions {
		moduleName := strings.TrimSpace(permission.ModuleName)
		if !allowedMap[moduleName] {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Invalid module_name: %s", moduleName),
			})
		}
	}

	userUUID, err := resolveUserUUIDByPublicID(publicUserID)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "User not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to resolve user",
		})
	}

	tx, err := database.PostgresDB.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to start permission update",
		})
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM user_access_permissions WHERE user_id = $1`, userUUID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to clear existing permissions",
		})
	}

	for _, permission := range req.Permissions {
		moduleName := strings.TrimSpace(permission.ModuleName)
		canCreate := permission.CanCreate
		canEdit := permission.CanEdit
		canDelete := permission.CanDelete
		canView := permission.CanView || canCreate || canEdit || canDelete
		if _, err := tx.Exec(
			`INSERT INTO user_access_permissions (user_id, module_name, can_create, can_view, can_edit, can_delete)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			userUUID,
			moduleName,
			canCreate,
			canView,
			canEdit,
			canDelete,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to save user permissions",
			})
		}
	}

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to finalize user permissions",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "User access updated successfully",
	})
}

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

	targetUserID := strings.TrimSpace(userIDClaim)
	if isAdmin(c) {
		publicUserID := strings.TrimSpace(c.Params("userId"))
		if publicUserID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "userId is required",
			})
		}

		resolvedUserID, err := resolveUserUUIDByPublicID(publicUserID)
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "User not found",
			})
		}
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to resolve user",
			})
		}

		targetUserID = strings.TrimSpace(resolvedUserID)
	}

	type UpdateUserRequest struct {
		FullName        string `json:"full_name"`
		PhoneNumber     string `json:"phone_number"`
		Email           string `json:"email"`
		ProfilePhotoURL string `json:"profile_photo_url"`
		Role            string `json:"role"`
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

	roleToUpdate := ""
	currentRole := ""
	if isAdmin(c) {
		roleToUpdate = normalizeRole(req.Role)
		if roleToUpdate != "" && roleToUpdate != "admin" && roleToUpdate != "bus_owner" && roleToUpdate != "accountant" && roleToUpdate != "time_keeper" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid role for back-office user",
			})
		}

		if err := database.QueryRow("SELECT role FROM users WHERE id = $1", targetUserID).Scan(&currentRole); err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "User not found",
				})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to resolve user role",
			})
		}
	}

	var user models.User
	err := database.QueryRow(
		"UPDATE users SET email = $2, phone_number = $3, full_name = $4, profile_photo_url = $5, role = CASE WHEN $6 <> '' THEN $6 ELSE role END, updated_at = NOW() WHERE id = $1 RETURNING id, email, phone_number, full_name, role, COALESCE(profile_photo_url, ''), created_at, updated_at, last_login, public_id",
		targetUserID,
		req.Email,
		req.PhoneNumber,
		req.FullName,
		req.ProfilePhotoURL,
		roleToUpdate,
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
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == "23505" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "this email already registered in the platform",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update user",
		})
	}

	if isAdmin(c) && roleToUpdate != "" && normalizeRole(roleToUpdate) != normalizeRole(currentRole) {
		tx, txErr := database.PostgresDB.Begin()
		if txErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to update role permissions",
			})
		}
		defer tx.Rollback()

		if permErr := resetUserPermissionsToRoleDefaults(tx, user.ID, roleToUpdate); permErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to update role permissions",
			})
		}

		if commitErr := tx.Commit(); commitErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to finalize role permissions",
			})
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"user":    user,
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
			"page":  page,
			"limit": limit,
			"total": 0,
		},
	})
}
