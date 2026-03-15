package models

import "time"

// User represents a system user (rider, bus_owner, accountant, admin)
type User struct {
	ID            string    `json:"id"`
	PublicID      string    `json:"public_id"`
	Email         string    `json:"email"`
	PhoneNumber   string    `json:"phone_number"`
	FullName      string    `json:"full_name"`
	Role          string    `json:"role"` // rider, bus_owner, accountant, admin
	PasswordHash  string    `json:"-"`
	ProfilePhotoURL string  `json:"profile_photo_url"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	LastLogin     *time.Time `json:"last_login"`
}

// PasswordResetToken represents a password reset token stored in the database
type PasswordResetToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	Used      bool      `json:"used"`
	CreatedAt time.Time `json:"created_at"`
}

// Ticket represents a purchased bus ticket
type Ticket struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	RouteID      string    `json:"route_id"`
	FromStopID   string    `json:"from_stop_id"`
	ToStopID     string    `json:"to_stop_id"`
	PurchaseDate time.Time `json:"purchase_date"`
	Amount       float64   `json:"amount"`
	Status       string    `json:"status"` // active, used, cancelled
	QRCodeHash   string    `json:"qr_code_hash"`
	ValidUntil   *time.Time `json:"valid_until"`
	CreatedAt    time.Time `json:"created_at"`
}

// Route represents a bus route
type Route struct {
	ID         string    `json:"id"`
	RouteNumber string   `json:"route_number"`
	BusNumber  string    `json:"bus_number"`
	CreatedBy  string    `json:"created_by"`
	Description string   `json:"description"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Stop represents a bus stop
type Stop struct {
	ID            string    `json:"id"`
	RouteID       string    `json:"route_id"`
	StopName      string    `json:"stop_name"`
	SequenceOrder int       `json:"sequence_order"`
	DistanceKm    float64   `json:"distance_km"`
	Amount        float64   `json:"amount"`
	Coordinates   string    `json:"coordinates"`
	CreatedAt     time.Time `json:"created_at"`
}

// Transaction represents a financial transaction
type Transaction struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	TicketID        string    `json:"ticket_id"`
	Amount          float64   `json:"amount"`
	TransactionDate time.Time `json:"transaction_date"`
	PaymentMethod   string    `json:"payment_method"`
	Status          string    `json:"status"` // completed, pending, failed
	Currency        string    `json:"currency"`
	CreatedAt       time.Time `json:"created_at"`
}

// Discrepancy represents a revenue discrepancy
type Discrepancy struct {
	ID              string    `json:"id"`
	RouteID         string    `json:"route_id"`
	BusNumber       string    `json:"bus_number"`
	TransactionDate time.Time `json:"transaction_date"`
	ExpectedRevenue float64   `json:"expected_revenue"`
	ActualRevenue   float64   `json:"actual_revenue"`
	LossAmount      float64   `json:"loss_amount"`
	Status          string    `json:"status"` // pending, investigating, resolved
	UpdatedBy       string    `json:"updated_by"`
	Notes           string    `json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Report represents a generated report
type Report struct {
	ID          string    `json:"id"`
	ReportType  string    `json:"report_type"` // daily, all_time, ticket_sales
	DateFrom    time.Time `json:"date_from"`
	DateTo      time.Time `json:"date_to"`
	Data        interface{} `json:"data"`
	CreatedBy   string    `json:"created_by"`
	ExportFormat string   `json:"export_format"`
	FilePath    string    `json:"file_path"`
	CreatedAt   time.Time `json:"created_at"`
}

// AlertSetting represents alert preferences for a user
type AlertSetting struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	AlertType string    `json:"alert_type"` // email, sms, in_app
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
}
