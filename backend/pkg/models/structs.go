package models

import (
	"database/sql"
	"time"
)

// --- CORE ENTITIES ---
type User struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	Password       string `json:"-"`
	Role           string `json:"role"`
	ContactNo      string `json:"contact_no"`
	OrganizationID int    `json:"organization_id"`
}

type Resource struct {
	ID                int            `json:"ID"`
	Name              string         `json:"Name"`
	Category          string         `json:"Category"`
	QuantityAvailable sql.NullInt64  `json:"QuantityAvailable"`
	Status            sql.NullString `json:"Status"`
	Location          sql.NullString `json:"Location"`
	RequestID         sql.NullInt64  `json:"RequestID"`
}

type Location struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	City string `json:"city"`
}

// --- TRANSACTION ENTITIES ---
type Request struct {
	ID           int           `json:"ID"`
	ResourceType string        `json:"ResourceType"`
	Quantity     int           `json:"Quantity"`
	Location     string        `json:"Location"`
	Status       string        `json:"Status"`
	RequestedBy  int           `json:"RequestedBy"`
	AssignedToID sql.NullInt64 `json:"AssignedToID"`
	CreatedAt    time.Time     `json:"CreatedAt"`
	UpdatedAt    time.Time     `json:"UpdatedAt"`
}
type Allocation struct {
	ID                int       `json:"id"`
	RequestID         int       `json:"request_id"`
	ResourceID        int       `json:"resource_id"`
	AllocatedQuantity int       `json:"allocated_quantity"`
	AllocatedBy       int       `json:"allocated_by"`
	FromLocation      int       `json:"from_location_id"`
	ToLocation        int       `json:"to_location_id"`
	DispatchDate      time.Time `json:"dispatch_date"`
	DeliveryStatus    string    `json:"delivery_status"`
}

// --- INPUT PAYLOAD ENTITIES ---
type NewRequestPayload struct {
	ResourceType string `json:"resource_type" binding:"required"`
	Quantity     int    `json:"quantity" binding:"required"`
	Location     string `json:"location" binding:"required"`
	CreatedByID  int    `json:"created_by_id" binding:"required"`
}

type NewInventoryPayload struct {
	Name     string `json:"name" binding:"required"`
	Category string `json:"category" binding:"required"`
	Quantity int    `json:"quantity" binding:"required"`
	Location string `json:"location"`
}

// --- AGGREGATION STRUCTS (FOR CHARTS) ---
type ResourceCount struct {
	Category string `json:"category"`
	Total    int    `json:"total"`
}
