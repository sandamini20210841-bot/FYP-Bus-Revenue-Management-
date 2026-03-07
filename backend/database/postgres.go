package database

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/busticket/backend/config"
	_ "github.com/lib/pq"
)

var PostgresDB *sql.DB

func InitPostgres(cfg *config.Config) error {
	var err error
	PostgresDB, err = sql.Open("postgres", cfg.PostgresURL)
	if err != nil {
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
		return err
	}

	log.Println("✅ PostgreSQL connected successfully")
	return nil
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
