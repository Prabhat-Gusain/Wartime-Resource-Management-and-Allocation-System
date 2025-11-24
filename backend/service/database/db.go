package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/godror/godror" // Modern Oracle Driver
	"github.com/joho/godotenv"
)

// DB represents the database connection pool object
var DB *sql.DB

func InitDB() error {
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: Could not find .env file, assuming environment variables are set: %v", err)
	}
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	service := os.Getenv("DB_SERVICE") // e.g., XE

	dsn := fmt.Sprintf("%s/%s@%s", user, password, service)

	db, err := sql.Open("godror", dsn)
	if err != nil {
		return fmt.Errorf("error opening database connection with godror: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)

	if err = db.Ping(); err != nil {
		return fmt.Errorf("error pinging database: %w", err)
	}

	DB = db
	log.Println("Successfully connected to Oracle Database using godror (Bequeath style)!")
	return nil
}
