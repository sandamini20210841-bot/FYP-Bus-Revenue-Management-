package config

import (
	"os"
	"strings"
)

type Config struct {
	// Server
	Port       string
	Prefork    bool
	Environment string
	CORSOrigins string

	// PostgreSQL
	PostgresURL string

	// MongoDB
	MongoURL    string
	MongoDBName string

	// JWT
	JWTSecret      string
	JWTExpiration  int
	RefreshExpiration int

	// Supabase
	SupabaseURL    string
	SupabaseKey    string
	SupabaseSecret string

	// SMS/OTP
	TwilioAccountSID   string
	TwilioAuthToken    string
	TwilioPhoneNumber  string
	OTPExpiration      int

	// SMTP
	SMTPHost     string
	SMTPPort     string
	SMTPEmail    string
	SMTPPassword string

	// Logging
	LogLevel string
}

func LoadConfig() *Config {
	return &Config{
		Port:              getEnv("PORT", "8000"),
		Prefork:           getEnvBool("PREFORK", false),
		Environment:       getEnv("ENVIRONMENT", "development"),
		CORSOrigins:       getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"),

		PostgresURL:       getEnv("POSTGRES_URL", "postgres://user:password@localhost:5432/busticket"),
		MongoURL:          getEnv("MONGO_URL", "mongodb://localhost:27017"),
		MongoDBName:       getEnv("MONGO_DB_NAME", "busticket"),

		JWTSecret:         getEnv("JWT_SECRET", "your-secret-key"),
		JWTExpiration:     getEnvInt("JWT_EXPIRATION", 3600),        // 1 hour
		RefreshExpiration: getEnvInt("REFRESH_EXPIRATION", 604800),   // 7 days

		SupabaseURL:       getEnv("SUPABASE_URL", ""),
		SupabaseKey:       getEnv("SUPABASE_KEY", ""),
		SupabaseSecret:    getEnv("SUPABASE_SECRET", ""),

		TwilioAccountSID:  getEnv("TWILIO_ACCOUNT_SID", ""),
		TwilioAuthToken:   getEnv("TWILIO_AUTH_TOKEN", ""),
		TwilioPhoneNumber: getEnv("TWILIO_PHONE_NUMBER", ""),
		OTPExpiration:     getEnvInt("OTP_EXPIRATION", 900), // 15 minutes

		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPEmail:    getEnv("SMTP_EMAIL", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),

		LogLevel: getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return strings.ToLower(value) == "true"
}

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	var result int
	if _, err := Sscanf(value, "%d", &result); err != nil {
		return defaultValue
	}
	return result
}

// Sparse sscanf implementation for simplicity
func Sscanf(str string, format string, a ...interface{}) (int, error) {
	n, err := ScanString(str, format, a...)
	return n, err
}

func ScanString(str string, format string, args ...interface{}) (int, error) {
	if len(args) == 0 {
		return 0, nil
	}
	if ptr, ok := args[0].(*int); ok {
		var v int
		_, err := parseIntString(str, &v)
		if err != nil {
			return 0, err
		}
		*ptr = v
		return 1, nil
	}
	return 0, nil
}

func parseIntString(s string, v *int) (string, error) {
	var i int
	var neg bool
	if len(s) > 0 && s[0] == '-' {
		neg = true
		s = s[1:]
	}
	for len(s) > 0 && s[0] >= '0' && s[0] <= '9' {
		i = i*10 + int(s[0]-'0')
		s = s[1:]
	}
	if neg {
		i = -i
	}
	*v = i
	return s, nil
}
