package router

import (
	"net/http"
	"resourcemanager/service/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func InitRouter(adminHandler *handlers.AdminHandler) *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.LoadHTMLGlob("frontend/templates/*")
	r.Static("/static", "frontend/static")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{
			"title": "War Resource Manager Dashboard",
		})
	})

	v1 := r.Group("/api/v1")
	{
		admin := v1.Group("/admin")
		{

			admin.GET("/requests/pending", adminHandler.GetPendingRequests)
			admin.POST("/requests/assign", adminHandler.AssignRequest)
			admin.POST("/requests/reject", adminHandler.RejectRequest)
			admin.POST("/requests/submit", adminHandler.SubmitNewRequest)

			admin.GET("/inventory", adminHandler.GetInventory)
			admin.GET("/resource-counts", adminHandler.GetResourceCounts)

			admin.POST("/inventory", adminHandler.AddNewInventoryItem)
			admin.DELETE("/inventory/:id", adminHandler.DeleteInventoryItem)
		}
	}

	return r
}
