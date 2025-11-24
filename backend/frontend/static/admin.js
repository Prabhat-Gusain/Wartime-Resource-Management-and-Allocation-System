(function() {

    // --- Configuration (Local Scope) ---
    const API_BASE_URL = 'http://localhost:9090/api/v1/admin';
    const URGENCY_THRESHOLD = 500;
    
    // Timer variables are disabled for stability.
    const POLLING_INTERVAL = 10000; 
    let pollingTimer = null; 


    // --- API FETCHING & DATA PROCESSING ---

    async function fetchPendingRequests() {
        try {
            const response = await fetch(`${API_BASE_URL}/requests/pending`);
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorBody.error || 'Server error'}`);
            }
            const requests = await response.json();
            renderAllocationTable(requests);
            renderUrgentDashboard(requests); 
        } catch (error) {
            console.error("Error fetching requests:", error);
            const errorMessage = `Failed to load data. Ensure the Go backend is running on Port 9090.`;
            const allocationTable = document.querySelector('#allocation .inventory-table tbody');
            if(allocationTable) {
                allocationTable.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--accent);"><i class="fas fa-exclamation-triangle"></i> ${errorMessage}</td></tr>`;
            }
            if (document.getElementById('urgent-requests-list')) {
                 document.getElementById('urgent-requests-list').innerHTML = 
                    `<li><div style="color: var(--accent);"><i class="fas fa-times-circle"></i> ${errorMessage}</div></li>`;
            }
        }
    }
    
    // Fetch Inventory Data
    async function fetchInventory() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory`);
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorBody.error || 'Server error'}`);
            }
            const resources = await response.json();
            renderInventoryTable(resources); 
        } catch (error) {
            console.error("Error fetching inventory:", error);
            const errorMessage = `Failed to load inventory data.`;
            const inventoryTable = document.querySelector('#inventory .inventory-table tbody');
            if(inventoryTable) {
                inventoryTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--accent);"><i class="fas fa-exclamation-triangle"></i> ${errorMessage}</td></tr>`;
            }
        }
    }

    // Handles the POST request to assign a request to an officer 
    async function assignRequest(requestID, officerID) {
        const payload = {
            request_id: requestID,
            officer_id: officerID
        };
        try {
            const response = await fetch(`${API_BASE_URL}/requests/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Assignment failed.");
            }
            alert(`Request #${requestID} successfully APPROVED and assigned!`);
            
            const allocationLink = document.querySelector('.nav-link[data-page="allocation"]');
            if (allocationLink) {
                allocationLink.click();
            } else {
                fetchPendingRequests(); // Fallback
            }
        } catch (error) {
            alert("Assignment Error: " + error.message);
            console.error("Assignment Error:", error);
        }
    }

    // Handles the POST request to reject a request
    async function rejectRequest(requestID) {
        const payload = { request_id: requestID };
        try {
            const response = await fetch(`${API_BASE_URL}/requests/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Rejection failed.");
            }
            alert(`Request #${requestID} successfully REJECTED.`);
            fetchPendingRequests(); // Refresh data
        } catch (error) {
            alert("Rejection Error: " + error.message);
            console.error("Rejection Failed:", error);
        }
    }

    // Add New Inventory Item
    async function addNewInventoryItem(payload) {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to add item.");
            }
            alert("Inventory item added successfully!");
            fetchInventory(); // Refresh the table
        } catch (error) {
            alert("Error adding item: " + error.message);
            console.error("Add inventory error:", error);
        }
    }

    // Delete an Inventory Item
    async function deleteInventoryItem(itemID) {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/${itemID}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete item.");
            }
            alert("Inventory item deleted successfully!");
            fetchInventory(); // Refresh the table
        } catch (error) {
            alert("Error deleting item: " + error.message);
            console.error("Delete inventory error:", error);
        }
    }


    // --- DOM RENDERING FUNCTIONS ---

    function renderAllocationTable(requests) {
        const tableBody = document.querySelector('#allocation .inventory-table tbody');
        if (!tableBody) return; 
        tableBody.innerHTML = ''; 

        if (!requests || requests.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No pending requests requiring approval.</td></tr>`;
            return;
        }

        requests.forEach(req => {
            const finalAssignedID = req.AssignedToID && req.AssignedToID.Valid 
                ? req.AssignedToID.Int64 
                : 'Unassigned';
            const location = req.Location || 'N/A';
            const resourceType = req.ResourceType || 'N/A';
            const status = req.Status || 'N/A';
            const createdAt = req.CreatedAt ? new Date(req.CreatedAt).toLocaleDateString() : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#REQ-${req.ID}</td>
                <td>${location}</td> 
                <td>${resourceType}</td>
                <td>${req.Quantity}</td>
                <td><span class="priority-medium">${status}</span></td>
                <td>${createdAt}</td>
                <td>${finalAssignedID}</td> 
                <td>
                    <button class="action-btn btn-edit btn-map-triage" 
                            data-id="${req.ID}" 
                            data-location="${location}" 
                            data-resource="${resourceType}"
                            data-quantity="${req.Quantity}">
                        <i class="fas fa-map-marker-alt"></i> Triage Map
                    </button>
                    <button class="action-btn btn-delete btn-reject" data-id="${req.ID}">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    // --------------------------------------------------
    // --- CRITICAL FIX: Updated renderInventoryTable ---
    // --------------------------------------------------
    function renderInventoryTable(resources) {
        const tableBody = document.querySelector('#inventory .inventory-table tbody');
        if (!tableBody) return; 
        tableBody.innerHTML = ''; 

        if (!resources || resources.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No inventory items found.</td></tr>`;
            return;
        }

        resources.forEach(res => {
            // Safely read nullable fields from the JSON
            const quantity = res.QuantityAvailable.Valid ? res.QuantityAvailable.Int64 : 0;
            const status = res.Status.Valid ? res.Status.String : 'N/A';
            const location = res.Location.Valid ? res.Location.String : 'N/A';
            
            // Determine status class based on 'status' string
            let statusClass = 'status-adequate';
            if (status === 'Low') {
                statusClass = 'status-low';
            } else if (status === 'Critical') {
                statusClass = 'status-critical';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${res.Name}</td>
                <td>${res.Category}</td>
                <td>${quantity}</td>
                <td>${location}</td>
                <td><span class="status-indicator ${statusClass}"></span> ${status}</td>
                <td>
                    <button class="action-btn btn-edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn btn-delete btn-inventory-delete" data-id="${res.ID}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function renderUrgentDashboard(allPendingRequests) {
        const listContainer = document.getElementById('urgent-requests-list');
        const badge = document.getElementById('urgent-badge');
        
        if (!listContainer || !badge) {
            console.warn("Required DOM elements for urgent dashboard rendering are missing (listContainer or badge).");
            return;
        }
        
        listContainer.innerHTML = ''; 
        
        if (!allPendingRequests) allPendingRequests = []; // Safety check

        const urgentRequests = allPendingRequests.filter(req => 
            req.Quantity > URGENCY_THRESHOLD
        );

        if (urgentRequests.length === 0) {
            listContainer.innerHTML = `<li><div style="color: var(--info);">No urgent requests at this time.</div></li>`;
            badge.textContent = '0 New';
            return;
        }

        urgentRequests.forEach(req => {
            const location = req.Location || 'N/A';
            const resourceType = req.ResourceType || 'N/A';

            const listItem = document.createElement('li');
            listItem.classList.add('request-item');
            listItem.innerHTML = `
                <div class="request-title">${resourceType} - Qty ${req.Quantity}</div>
                <div class="request-details">
                    <span>Location: ${location}</span>
                    <span class="priority-high">High Priority</span>
                    <button class="btn btn-primary btn-sm btn-map-triage" 
                            data-id="${req.ID}" 
                            data-location="${location}"
                            data-resource="${resourceType}"
                            data-quantity="${req.Quantity}">
                        Triage Map
                    </button>
                    <button class="btn btn-secondary btn-sm btn-reject" data-id="${req.ID}">
                        Reject
                    </button>
                </div>
            `;
            listContainer.appendChild(listItem);
        });

        badge.textContent = `${urgentRequests.length} New`;
    }


    // --- INITIALIZATION AND EVENT HANDLING ---

    document.addEventListener('DOMContentLoaded', function() {
        const navLinks = document.querySelectorAll('.nav-link');
        const pages = document.querySelectorAll('.page');
        
        // 1. Attach event listener for the "Submit Request" form 
        const requestForm = document.getElementById('request-submission-form');
        if (requestForm) {
            requestForm.addEventListener('submit', async function(e) {
                e.preventDefault(); 
                const VOLUNTEER_ID = 5; 
                const payload = {
                    resource_type: document.getElementById('request-resource-type')?.value || '',
                    quantity: parseInt(document.getElementById('request-quantity')?.value || '0'),
                    location: document.getElementById('request-location')?.value || '',
                    created_by_id: VOLUNTEER_ID 
                };

                if (!payload.resource_type || !payload.quantity || payload.quantity <= 0 || !payload.location) {
                    alert("Please fill out all required fields: Resource Type, Quantity, and Location.");
                    return;
                }

                try {
                    const targetUrl = API_BASE_URL + '/requests/submit';
                    const response = await fetch(targetUrl, { 
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to submit request to the server.");
                    }

                    alert("Request successfully submitted! Awaiting Commander approval.");
                    requestForm.reset(); 
                    
                    const allocationLink = document.querySelector('.nav-link[data-page="allocation"]');
                    if (allocationLink) {
                        allocationLink.click();
                    } else {
                        fetchPendingRequests(); 
                    }
                } catch (error) {
                    alert("Error submitting request: " + error.message);
                    console.error("Submission error:", error);
                }
            });
        }

        // --------------------------------------------------
        // --- CRITICAL FIX: Updated Inventory Form Listener ---
        // --------------------------------------------------
        const inventoryForm = document.getElementById('inventory-submission-form');
        if (inventoryForm) {
            inventoryForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const payload = {
                    name: document.getElementById('inv-name')?.value || '',
                    category: document.getElementById('inv-category')?.value || '',
                    quantity: parseInt(document.getElementById('inv-quantity')?.value || '0'),
                    location: document.getElementById('inv-location')?.value || '', // Added location
                    // REMOVED: unit and critical_level (they don't exist in DB)
                };

                if (!payload.name || !payload.category || payload.quantity <= 0) {
                    alert("Please fill out at least Name, Category, and Quantity.");
                    return;
                }

                await addNewInventoryItem(payload);
                inventoryForm.reset();
            });
        }
        
        // 3. Use Event Delegation for ALL dynamic buttons
        document.addEventListener('click', function(e) {
            
            const mapButton = e.target.closest('.btn-map-triage');
            const rejectButton = e.target.closest('.btn-reject');
            const assignButton = e.target.closest('.assign-urgent');
            const mapAssignButton = e.target.closest('.btn-map-assign');
            const inventoryDeleteButton = e.target.closest('.btn-inventory-delete');

            // Triage Map Button (from Allocation or Dashboard)
            if (mapButton) {
                const button = mapButton;
                const requestId = button.getAttribute('data-id');
                const requestLocation = button.getAttribute('data-location');
                const resourceType = button.getAttribute('data-resource');
                const quantity = button.getAttribute('data-quantity');
                
                sessionStorage.setItem('triageRequestID', requestId);
                sessionStorage.setItem('triageRequestLocation', requestLocation);
                sessionStorage.setItem('triageResourceType', resourceType);
                sessionStorage.setItem('triageQuantity', quantity);

                const mapLink = document.querySelector('.nav-link[data-page="map"]');
                if (mapLink) {
                    mapLink.click();
                } else {
                    alert("Map navigation link not found.");
                }
            }

            // Reject Button (from Allocation or Dashboard)
            if (rejectButton) {
                const button = rejectButton;
                const requestId = parseInt(button.getAttribute('data-id'));
                if (confirm(`Are you sure you want to REJECT Request #${requestId}?`)) {
                    rejectRequest(requestId);
                }
            }

            // Assign (Approve) Button (from Urgent Dashboard list)
            if (assignButton) {
                const button = assignButton;
                const requestId = parseInt(button.getAttribute('data-id'));
                const officerId = parseInt(button.getAttribute('data-officer'));
                
                if (confirm(`Approve and Assign Urgent Request #${requestId} to Officer ${officerId}?`)) {
                    assignRequest(requestId, officerId); 
                }
            }
            
            // Final Assignment Button (from Map Popup)
            if (mapAssignButton) {
                const button = mapAssignButton;
                const requestId = parseInt(button.getAttribute('data-id'));
                const officerId = parseInt(button.getAttribute('data-officer'));
                
                if (confirm(`Confirm assignment of Request #${requestId} to Officer ${officerId}?`)) {
                    assignRequest(requestId, officerId);
                }
            }
            
            // Inventory Delete Button Logic
            if (inventoryDeleteButton) {
                const button = inventoryDeleteButton;
                const itemID = parseInt(button.getAttribute('data-id'));
                if (confirm(`Are you sure you want to permanently DELETE item #${itemID}?`)) {
                    deleteInventoryItem(itemID);
                }
            }
        });
        
        // 4. Navigation Logic
        const initMap = typeof window.initMap === 'function' ? window.initMap : () => console.log("Map not initialized.");
        const initCharts = typeof window.initCharts === 'function' ? window.initCharts : () => console.log("Charts not initialized.");
        
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault(); 
                const targetPage = this.getAttribute('data-page');
                navLinks.forEach(navLink => navLink.classList.remove('active'));
                this.classList.add('active');
                
                pages.forEach(page => {
                    page.classList.remove('active');
                    if (page.id === targetPage) {
                        page.classList.add('active');
                        
                        if (targetPage === 'allocation' || targetPage === 'dashboard') {
                            fetchPendingRequests(); 
                        } 
                        else if (targetPage === 'inventory') {
                            fetchInventory(); 
                        }
                        else if (targetPage === 'map') {
                             initMap();
                        } 
                        else if (targetPage === 'dashboard' || targetPage === 'reports') {
                             initCharts();
                        }
                    }
                });
            });
        });
        
        // 5. Initial Load Operations
        if (document.getElementById('dashboard')?.classList.contains('active')) {
            fetchPendingRequests();
            if (typeof initCharts === 'function') initCharts(); 
        }
    });

})();