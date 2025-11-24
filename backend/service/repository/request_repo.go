package repository

import (
	"database/sql"
	"fmt"
	"log"

	"resourcemanager/pkg/models"
)

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

type requestRepositoryImpl struct {
	DB *sql.DB
}

func NewRequestRepository(db *sql.DB) RequestRepository {
	return &requestRepositoryImpl{DB: db}
}

func (r *requestRepositoryImpl) GetAllPendingRequests() ([]models.Request, error) {
	const sqlQuery = `SELECT REQUESTID, REQUESTTYPE, QUANTITY, LOCATION, STATUS, CREATEDBYID, ASSIGNEDUSERID, CREATEDAT, UPDATEDAT FROM REQUESTS WHERE UPPER(STATUS) = 'PENDING' OR UPPER(STATUS) = 'NEW' ORDER BY CREATEDAT ASC`
	rows, err := r.DB.Query(sqlQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	requests := []models.Request{}
	for rows.Next() {
		var req models.Request
		var assignedUserID sql.NullInt64
		var createdAt sql.NullTime
		var updatedAt sql.NullTime
		err := rows.Scan(
			&req.ID, &req.ResourceType, &req.Quantity, &req.Location, &req.Status,
			&req.RequestedBy, &assignedUserID, &createdAt, &updatedAt,
		)
		if err != nil {
			log.Printf("ERROR: Failed to scan request row: %v", err)
			continue
		}
		req.AssignedToID = assignedUserID
		if createdAt.Valid {
			req.CreatedAt = createdAt.Time
		}
		if updatedAt.Valid {
			req.UpdatedAt = updatedAt.Time
		}
		requests = append(requests, req)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return requests, nil
}

func (r *requestRepositoryImpl) AssignRequestToOfficer(requestID int, officerID int) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	const getRequestSQL = `SELECT REQUESTTYPE, QUANTITY FROM REQUESTS WHERE REQUESTID = :1 AND STATUS = 'Pending'`
	var resourceType string
	var quantity int
	row := tx.QueryRow(getRequestSQL, requestID)
	if err := row.Scan(&resourceType, &quantity); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("request with ID %d not found", requestID)
		}
		return fmt.Errorf("error fetching request details: %w", err)
	}

	var availableQty sql.NullInt64
	const getInventorySQL = `SELECT QUANTITYAVAILABLE FROM RESOURCES WHERE TYPE = :1 FOR UPDATE`
	row = tx.QueryRow(getInventorySQL, resourceType)
	if err := row.Scan(&availableQty); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("no inventory found for resource: %s", resourceType)
		}
		return fmt.Errorf("error fetching inventory: %w", err)
	}

	if !availableQty.Valid || availableQty.Int64 < int64(quantity) {
		return fmt.Errorf("insufficient inventory for %s. Available: %d, Requested: %d", resourceType, availableQty.Int64, quantity)
	}

	newQty := availableQty.Int64 - int64(quantity)
	const updateInventorySQL = `UPDATE RESOURCES SET QUANTITYAVAILABLE = :1 WHERE TYPE = :2`
	_, err = tx.Exec(updateInventorySQL, newQty, resourceType)
	if err != nil {
		return fmt.Errorf("error updating inventory: %w", err)
	}

	const updateRequestSQL = `UPDATE REQUESTS SET STATUS = :1, ASSIGNEDUSERID = :2 WHERE REQUESTID = :3`
	_, err = tx.Exec(updateRequestSQL, "Approved", officerID, requestID)
	if err != nil {
		return fmt.Errorf("error updating request status: %w", err)
	}

	return tx.Commit()
}

func (r *requestRepositoryImpl) RejectRequest(requestID int) error {
	const sqlUpdate = `UPDATE REQUESTS SET STATUS = 'Rejected' WHERE REQUESTID = :1`
	res, err := r.DB.Exec(sqlUpdate, requestID)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("no request found with ID %d", requestID)
	}
	return nil
}

func (r *requestRepositoryImpl) CreateNewRequest(payload models.NewRequestPayload) error {
	const sqlInsert = `
		INSERT INTO REQUESTS (REQUESTTYPE, QUANTITY, LOCATION, STATUS, CREATEDBYID, ASSIGNEDUSERID)
		VALUES (:1, :2, :3, :4, :5, NULL)
	`
	_, err := r.DB.Exec(
		sqlInsert, payload.ResourceType, payload.Quantity, payload.Location,
		"Pending", payload.CreatedByID,
	)
	return err
}

func (r *requestRepositoryImpl) GetAllInventory() ([]models.Resource, error) {
	const sqlQuery = `
        SELECT 
            RESOURCEID, NAME, TYPE AS CATEGORY, QUANTITYAVAILABLE, STATUS, LOCATION, REQUESTID
        FROM RESOURCES
        ORDER BY TYPE, NAME
    `
	rows, err := r.DB.Query(sqlQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	resources := []models.Resource{}

	for rows.Next() {
		var res models.Resource
		err := rows.Scan(
			&res.ID,
			&res.Name,
			&res.Category,
			&res.QuantityAvailable,
			&res.Status,
			&res.Location,
			&res.RequestID,
		)
		if err != nil {
			log.Printf("ERROR: Failed to scan inventory row: %v", err)
			continue
		}
		resources = append(resources, res)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return resources, nil
}

func (r *requestRepositoryImpl) GetResourceCounts() ([]models.ResourceCount, error) {
	const sqlQuery = `
        SELECT 
            TYPE, 
            SUM(QUANTITYAVAILABLE) AS TOTAL
        FROM RESOURCES
        GROUP BY TYPE
        ORDER BY TYPE
    `
	rows, err := r.DB.Query(sqlQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := []models.ResourceCount{}
	for rows.Next() {
		var count models.ResourceCount
		err := rows.Scan(
			&count.Category,
			&count.Total,
		)
		if err != nil {
			log.Printf("ERROR: Failed to scan resource count row: %v", err)
			continue
		}
		counts = append(counts, count)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return counts, nil
}

func (r *requestRepositoryImpl) AddNewInventoryItem(payload models.NewInventoryPayload) error {

	const sqlInsert = `
		INSERT INTO RESOURCES (NAME, TYPE, QUANTITYAVAILABLE, LOCATION, STATUS)
		VALUES (:1, :2, :3, :4, 'Available')
	`
	_, err := r.DB.Exec(
		sqlInsert,
		payload.Name,
		payload.Category, // Maps to TYPE
		payload.Quantity,
		payload.Location,
	)
	if err != nil {
		return fmt.Errorf("error inserting new inventory item: %w", err)
	}
	log.Printf("Successfully inserted new resource: %s", payload.Name)
	return nil
}

func (r *requestRepositoryImpl) DeleteInventoryItem(itemID int) error {
	const sqlDelete = `DELETE FROM RESOURCES WHERE RESOURCEID = :1`

	res, err := r.DB.Exec(sqlDelete, itemID)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("no inventory item found with ID %d", itemID)
	}
	return nil
}
