package handlers

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
)

func isActionAllowed(state accessPermissionState, action string) bool {
	switch strings.TrimSpace(strings.ToLower(action)) {
	case "create":
		return state.canCreate
	case "view":
		return state.canView
	case "edit":
		return state.canEdit
	case "delete":
		return state.canDelete
	default:
		return false
	}
}

func getModulePermissionStateForUser(userUUID string, moduleName string) (accessPermissionState, error) {
	var role string
	if err := database.QueryRow(`SELECT role FROM users WHERE id = $1`, userUUID).Scan(&role); err != nil {
		return accessPermissionState{}, err
	}

	var canCreate bool
	var canView bool
	var canEdit bool
	var canDelete bool
	err := database.QueryRow(
		`SELECT can_create, can_view, can_edit, can_delete
		 FROM user_access_permissions
		 WHERE user_id = $1 AND module_name = $2`,
		userUUID,
		moduleName,
	).Scan(&canCreate, &canView, &canEdit, &canDelete)
	if err == nil {
		return accessPermissionState{canCreate: canCreate, canView: canView, canEdit: canEdit, canDelete: canDelete}, nil
	}
	if err != sql.ErrNoRows {
		return accessPermissionState{}, err
	}

	roleDefaults := roleDefaultPermissions(role)
	if state, ok := roleDefaults[moduleName]; ok {
		return state, nil
	}

	return accessPermissionState{}, nil
}

func enforceModulePermission(c *fiber.Ctx, moduleName string, action string) error {
	rawUserID := c.Locals("userId")
	userUUID := strings.TrimSpace(fmt.Sprint(rawUserID))
	if userUUID == "" || userUUID == "<nil>" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user in context",
		})
	}

	state, err := getModulePermissionStateForUser(userUUID, strings.TrimSpace(strings.ToLower(moduleName)))
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to evaluate user permissions",
		})
	}

	if !isActionAllowed(state, action) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	return nil
}
