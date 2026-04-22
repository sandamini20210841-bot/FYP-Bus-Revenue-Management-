package database

import (
	"context"
	"database/sql"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/busticket/backend/config"
	_ "github.com/lib/pq"
)

var PostgresDB *sql.DB

func InitPostgres(cfg *config.Config) error {
	log.Printf("[POSTGRES] Initializing connection")
	log.Printf("[POSTGRES] DSN: %s", redactPostgresURL(cfg.PostgresURL))
	log.Printf("[POSTGRES] Target: %s", describePostgresTarget(cfg.PostgresURL))

	var err error
	PostgresDB, err = sql.Open("postgres", cfg.PostgresURL)
	if err != nil {
		log.Printf("[POSTGRES] sql.Open failed: %v", err)
		return err
	}

	// Set connection pool settings
	PostgresDB.SetMaxOpenConns(25)
	PostgresDB.SetMaxIdleConns(5)
	PostgresDB.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := PostgresDB.PingContext(ctx); err != nil {
		log.Printf("[POSTGRES] Ping failed for %s: %v", describePostgresTarget(cfg.PostgresURL), err)
		return err
	}

	log.Printf("[POSTGRES] Connected successfully to %s", describePostgresTarget(cfg.PostgresURL))
	return nil
}

func describePostgresTarget(postgresURL string) string {
	parsed, err := url.Parse(postgresURL)
	if err != nil {
		return "unparseable connection string"
	}

	host := parsed.Host
	if host == "" {
		host = "<empty>"
	}

	dbName := strings.TrimPrefix(parsed.Path, "/")
	if dbName == "" {
		dbName = "<empty>"
	}

	return "host=" + host + " db=" + dbName
}

func redactPostgresURL(postgresURL string) string {
	parsed, err := url.Parse(postgresURL)
	if err != nil {
		return "<invalid postgres url>"
	}

	if parsed.User != nil {
		username := parsed.User.Username()
		if username != "" {
			parsed.User = url.UserPassword(username, "***")
		}
	}

	return parsed.String()
}

func ClosePostgres() error {
	if PostgresDB != nil {
		return PostgresDB.Close()
	}
	return nil
}

// Helper function to execute queries
func QueryRow(query string, args ...interface{}) *sql.Row {
	return PostgresDB.QueryRow(query, args...)
}

func Query(query string, args ...interface{}) (*sql.Rows, error) {
	return PostgresDB.Query(query, args...)
}

func Exec(query string, args ...interface{}) (sql.Result, error) {
	return PostgresDB.Exec(query, args...)
}
