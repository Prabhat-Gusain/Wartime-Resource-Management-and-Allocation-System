// Global variables to hold Chart.js instances
let resourceChartInstance = null;
let consumptionChartInstance = null;
let requestsChartInstance = null;
let shortageChartInstance = null;
let mapInstance = null; 

// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    // Page navigation
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    
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
                    
                    if (targetPage === 'map') {
                        initMap(); 
                    } else if (targetPage === 'dashboard' || targetPage === 'reports') {
                        initCharts(); // Fetch and render new charts
                    }
                }
            });
        });
    });
    
    // --------------------------------------------------------------------------------
    // MAP LOGIC (Triage Workflow)
    // --------------------------------------------------------------------------------
    window.initMap = async function() { 
        if (!document.getElementById('resource-map')) return;

        if (mapInstance) {
            mapInstance.remove(); 
        }
        
        mapInstance = L.map('resource-map').setView([28.6139, 77.2090], 5); 
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);
        
        // This is our "Geocoding" lookup table for *named* locations
        const resources = [
            {name: 'Headquarters', lat: 28.6139, lng: 77.2090}, // New Delhi
            {name: 'Northern Base', lat: 34.1526, lng: 77.5770}, // Leh
            {name: 'Eastern Depot', lat: 22.5726, lng: 88.3639}, // Kolkata
            {name: 'Western Camp', lat: 19.0760, lng: 72.8777}, // Mumbai
            {name: 'Jogiwala', lat: 30.2965, lng: 78.0645},
            {name: 'Vivekanad Gram', lat: 30.2980, lng: 78.0700}, 
            {name: 'Dehradun', lat: 30.3165, lng: 78.0322},
            {name: 'Uttrakhand', lat: 30.0668, lng: 79.0193}
        ];
        
        // Define the style for our red markers
        const redMarkerOptions = {
            radius: 8, color: 'red', fillColor: '#f03', fillOpacity: 0.8
        };

        let markers = []; 

        try {
            // 1. Fetch ALL pending requests from the GIN API
            const response = await fetch('http://localhost:9090/api/v1/admin/requests/pending');
            if (!response.ok) {
                throw new Error("Failed to fetch pending requests for map.");
            }
            const pendingRequests = await response.json();

            // 2. Iterate and plot each request
            pendingRequests.forEach(req => {
                let lat, lng;
                
                // Parse coordinates from the req.Location string
                const coords = req.Location.split(',');
                if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                    lat = parseFloat(coords[0]);
                    lng = parseFloat(coords[1]);
                } else {
                    // Fall back to lookup table for named locations
                    const targetLocation = resources.find(r => r.name.toUpperCase() === req.Location.toUpperCase());
                    if (targetLocation) {
                        lat = targetLocation.lat;
                        lng = targetLocation.lng;
                    } else {
                        console.warn(`Could not parse or find location: ${req.Location}`);
                        return; // Skip this marker
                    }
                }

                // 3. Create a red circle marker
                const marker = L.circleMarker([lat, lng], redMarkerOptions).addTo(mapInstance);
                
                // 4. Add the popup with request info and the assignment button
                marker.bindPopup(`
                    <b>Pending Request #${req.ID}</b><br>
                    <b>Location:</b> ${req.Location}<br>
                    <b>Resource:</b> ${req.ResourceType} (Qty: ${req.Quantity})
                    <hr>
                    <p>Assign this request to Officer 4?</p>
                    <button class="btn btn-primary btn-sm btn-map-assign" 
                            data-id="${req.ID}" 
                            data-officer="4">
                        Confirm Assignment
                    </button>
                `);
                
                markers.push(marker);
            });

            // 5. Fit the map to show all the new red markers
            if (markers.length > 0) {
                const group = new L.featureGroup(markers);
                mapInstance.fitBounds(group.getBounds().pad(0.1));
            }

        } catch (error) {
            console.error("Error loading map request data:", error);
            alert("Could not load pending requests on the map.");
        }
    }
    
    // --------------------------------------------------------------------------------
    // NEW CHART LOGIC: Fetches live data from the backend
    // --------------------------------------------------------------------------------
    window.initCharts = async function() { // Make initCharts globally accessible
        
        // FIX: DESTRUCTION LOGIC
        if (resourceChartInstance) resourceChartInstance.destroy();
        if (consumptionChartInstance) consumptionChartInstance.destroy();
        if (requestsChartInstance) requestsChartInstance.destroy();
        if (shortageChartInstance) shortageChartInstance.destroy();

        // --- Fetch data for the doughnut chart ---
        let resourceLabels = ['Food', 'Fuel', 'Medical', 'Weapons', 'Manpower'];
        let resourceData = [0, 0, 0, 0, 0]; // Default data
        
        try {
            const response = await fetch('http://localhost:9090/api/v1/admin/resource-counts');
            if (!response.ok) {
                throw new Error("Failed to fetch chart data.");
            }
            const counts = await response.json(); // e.g., [{"category": "Food", "total": 12450}, ...]
            
            // Map the fetched data into the chart arrays
            const dataMap = new Map(counts.map(c => [c.category, c.total]));
            resourceLabels = resourceLabels.map(label => label); // Ensure order
            resourceData = resourceLabels.map(label => dataMap.get(label) || 0);

        } catch (error) {
            console.error("Error fetching resource counts for chart:", error);
            // Chart will render with 0 data
        }

        // Resource distribution chart (NOW DYNAMIC)
        const resourceCtx = document.getElementById('resourceChart');
        if (resourceCtx) {
            resourceChartInstance = new Chart(resourceCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: resourceLabels,
                    datasets: [{
                        data: resourceData, // <-- LIVE DATA
                        backgroundColor: ['#27ae60', '#f39c12', '#e74c3c', '#2c3e50', '#3498db']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }
        
        // Consumption chart (Still dummy data)
        const consumptionCtx = document.getElementById('consumptionChart');
        if (consumptionCtx) {
            consumptionChartInstance = new Chart(consumptionCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
                    datasets: [
                        { label: 'Food', data: [1200, 1900, 1700, 1500, 1800, 1600, 1400], borderColor: '#27ae60', tension: 0.1 },
                        { label: 'Fuel', data: [800, 1200, 1100, 900, 1000, 950, 850], borderColor: '#f39c12', tension: 0.1 },
                        { label: 'Medical', data: [400, 550, 500, 450, 500, 480, 460], borderColor: '#e74c3c', tension: 0.1 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }
        
        // Requests chart (Still dummy data)
        const requestsCtx = document.getElementById('requestsChart');
        if (requestsCtx) {
            requestsChartInstance = new Chart(requestsCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Food', 'Fuel', 'Medical', 'Weapons', 'Manpower'],
                    datasets: [
                        { label: 'Approved', data: [12, 19, 8, 15, 7], backgroundColor: '#27ae60' },
                        { label: 'Pending', data: [5, 8, 12, 3, 4], backgroundColor: '#f39c12' },
                        { label: 'Rejected', data: [2, 3, 1, 5, 2], backgroundColor: '#e74c3c' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
            });
        }
        
        // Shortage prediction chart (Still dummy data)
        const shortageCtx = document.getElementById('shortageChart');
        if (shortageCtx) {
            shortageChartInstance = new Chart(shortageCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Food', 'Fuel', 'Medical', 'Weapons', 'Manpower'],
                    datasets: [{
                        label: 'Days until shortage',
                        data: [45, 23, 12, 60, 18],
                        backgroundColor: ['#27ae60', '#f39c12', '#e74c3c', '#2c3e50', '#3498db']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Days remaining' } } } }
            });
        }
    }
}); // DOMContentLoaded end