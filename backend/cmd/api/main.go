package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"resourcemanager/service/database"
	handler "resourcemanager/service/handlers"
	repo "resourcemanager/service/repository"
	"resourcemanager/service/router"
)

func main() {
	log.Println("Resource Manager Backend Starting...")

	if err := godotenv.Load(); err != nil {
		log.Println("Warning: Could not find .env file, assuming environment variables are set:", err)
	}

	if os.Getenv("GIN_MODE") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}

	if err := database.InitDB(); err != nil {
		log.Fatalf("FATAL: Could not initialize database: %v", err)
	}
	defer database.DB.Close()
	log.Println("Database connection is ready.")

	requestRepo := repo.NewRequestRepository(database.DB)

	adminHandler := handler.NewAdminHandler(requestRepo)

	r := router.InitRouter(adminHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	log.Printf("\nHTTP Server listening on port %s. Admin API is live at /api/v1/admin/...", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("FATAL: Failed to start server: %v", err)
	}
}
