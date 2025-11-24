package handlers

import (
	"log"
	"net/http"
	"resourcemanager/pkg/models"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// RequestRepository defines the methods the handler depends on.
type RequestRepository interface {
	GetAllPendingRequests() ([]models.Request, error)
	AssignRequestToOfficer(requestID int, officerID int) error
	RejectRequest(requestID int) error
	CreateNewRequest(payload models.NewRequestPayload) error
	GetAllInventory() ([]models.Resource, error)
	GetResourceCounts() ([]models.ResourceCount, error)
	AddNewInventoryItem(payload models.NewInventoryPayload) error
	DeleteInventoryItem(itemID int) error
}

// AdminHandler struct holds the dependency on the local RequestRepository interface
type AdminHandler struct {
	RequestRepo RequestRepository
}

// NewAdminHandler creates a new handler instance
func NewAdminHandler(r RequestRepository) *AdminHandler {
	return &AdminHandler{RequestRepo: r}
}

// ... (GetPendingRequests, RejectRequest, SubmitNewRequest handlers omitted for brevity) ...
func (h *AdminHandler) GetPendingRequests(c *gin.Context) {
	requests, err := h.RequestRepo.GetAllPendingRequests()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve requests"})
		return
	}
	c.JSON(http.StatusOK, requests)
}
func (h *AdminHandler) RejectRequest(c *gin.Context) {
	var rejection struct {
		RequestID int `json:"request_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&rejection); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID format"})
		return
	}
	err := h.RequestRepo.RejectRequest(rejection.RequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Request successfully rejected"})
}
func (h *AdminHandler) SubmitNewRequest(c *gin.Context) {
	var reqData models.NewRequestPayload
	if err := c.ShouldBindJSON(&reqData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format"})
		return
	}
	err := h.RequestRepo.CreateNewRequest(reqData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit request"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Request submitted successfully"})
}
func (h *AdminHandler) GetInventory(c *gin.Context) {
	resources, err := h.RequestRepo.GetAllInventory()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve inventory"})
		return
	}
	c.JSON(http.StatusOK, resources)
}
func (h *AdminHandler) GetResourceCounts(c *gin.Context) {
	counts, err := h.RequestRepo.GetResourceCounts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve resource counts"})
		return
	}
	c.JSON(http.StatusOK, counts)
}
func (h *AdminHandler) AddNewInventoryItem(c *gin.Context) {
	var payload models.NewInventoryPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format"})
		return
	}
	err := h.RequestRepo.AddNewInventoryItem(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save item"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Inventory item added"})
}
func (h *AdminHandler) DeleteInventoryItem(c *gin.Context) {
	idParam := c.Param("id")
	itemID, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
		return
	}
	err = h.RequestRepo.DeleteInventoryItem(itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete item"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Inventory item deleted"})
}

func (h *AdminHandler) AssignRequest(c *gin.Context) {
	var assignment struct {
		RequestID int `json:"request_id" binding:"required"`
		OfficerID int `json:"officer_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&assignment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Call the new, complex repository logic
	err := h.RequestRepo.AssignRequestToOfficer(assignment.RequestID, assignment.OfficerID)

	if err != nil {
		//  Check for the specific "insufficient inventory" error
		if strings.Contains(err.Error(), "insufficient inventory") {
			log.Printf("Validation Error assigning request %d: %v", assignment.RequestID, err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}) // Send the specific error to the user
			return
		}
		// Other errors (like "request not found")
		if strings.Contains(err.Error(), "not found") {
			log.Printf("Not found error assigning request %d: %v", assignment.RequestID, err)
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		// General server error
		log.Printf("Error assigning request %d: %v", assignment.RequestID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Assignment failed due to database constraint"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request approved and assigned successfully", "request_id": assignment.RequestID})
}
