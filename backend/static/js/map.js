// Global variables for map and markers
let map; // Leaflet map instance
let markers = []; // Array of all service markers on the map
let userMarker = null; // Marker showing user's current location
let markerCluster = null; // Marker cluster group for grouping nearby markers
let searchLines = []; // Lines drawn from user location to services
let searchCircle = null; // Circle showing radius search area
let routeLayer = null; // Polyline showing route to selected service
let userLocation = { lat: 53.3365, lng: -6.2856 }; // Default location (Dublin city center)
const API_BASE = '/api'; // Base URL for API endpoints

// Configuration for each service type with colors and icons
const serviceConfig = {
    hospital: { color: '#FF385C', icon: '🏥', label: 'Hospital' },
    police: { color: '#3B82F6', icon: '👮', label: 'Police Station' },
    fire: { color: '#F59E0B', icon: '🚒', label: 'Fire Station' }
};

// Initialize the Leaflet map
function initMap() {
    // Create map instance with canvas rendering for better performance
    map = L.map('map', {
        preferCanvas: true, // Use canvas instead of SVG for better performance with many markers
        zoomControl: true, // Show zoom controls
        attributionControl: true // Show attribution
    }).setView([userLocation.lat, userLocation.lng], 13); // Center on Dublin with zoom level 13
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19, // Maximum zoom level
        tileSize: 256 // Tile size in pixels
    }).addTo(map);

    // Fix map size calculation after container is fully loaded
    setTimeout(() => map.invalidateSize(), 100);

    // Create marker cluster group to group nearby markers together
    markerCluster = L.markerClusterGroup({
        maxClusterRadius: 50, // Maximum radius to cluster markers
        spiderfyOnMaxZoom: true, // Spread out markers when zoomed in
        showCoverageOnHover: true, // Show circle when hovering over cluster
        zoomToBoundsOnClick: true, // Zoom to show all markers when clicking cluster
        disableClusteringAtZoom: 15, // Stop clustering at zoom level 15
        chunkedLoading: true, // Load markers in chunks for better performance
        chunkInterval: 200, // Time between chunks
        chunkDelay: 50 // Delay before starting chunks
    });
    map.addLayer(markerCluster);

    // Add initial user location marker
    addUserMarker(userLocation.lat, userLocation.lng);

    // Handle map clicks to set user location
    map.on('click', function(e) {
        userLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
        addUserMarker(e.latlng.lat, e.latlng.lng);
        updateLocationDisplay();
        // Get address for the clicked location
        reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    // Load all emergency services and statistics on page load
    loadAllServices();
    loadStatistics();
}

function updateLocationDisplay() {
    document.getElementById('currentLat').textContent = userLocation.lat.toFixed(4);
    document.getElementById('currentLng').textContent = userLocation.lng.toFixed(4);
    document.getElementById('inputLat').value = userLocation.lat.toFixed(4);
    document.getElementById('inputLng').value = userLocation.lng.toFixed(4);
}

// Search for address and move map to that location
async function searchAddress() {
    const input = document.getElementById('addressInput').value.trim();
    const searchButton = document.querySelector('.btn-success-custom');
    
    // Validate input
    if (!input) {
        showAlert('Please enter an address', 'error');
        return;
    }
    
    // Show loading state on search button
    if (searchButton) {
        searchButton.disabled = true;
        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    showAlert('🔍 Searching...', 'info');
    
    try {
        // Call geocoding API to convert address to coordinates
        const response = await fetch(`${API_BASE}/geocode/?query=${encodeURIComponent(input)}`);
        const data = await response.json();
        
        if (response.ok && data.lat && data.lng) {
            const lat = parseFloat(data.lat);
            const lng = parseFloat(data.lng);
            
            // Validate coordinates are within Ireland bounds
            // Ireland latitude: 51.4 to 55.4, longitude: -10.5 to -5.5
            if (lat >= 51.4 && lat <= 55.4 && lng >= -10.5 && lng <= -5.5) {
                // Update user location and map
                userLocation = { lat, lng };
                addUserMarker(lat, lng);
                map.setView([lat, lng], 16); // Zoom to level 16 for street view
                updateLocationDisplay();
                
                // Update input field with formatted address if available
                if (data.formatted_address) {
                    document.getElementById('addressInput').value = data.formatted_address;
                }
                
                showAlert(`✓ Found: ${data.formatted_address || input}`, 'success');
                if (searchButton) {
                    searchButton.disabled = false;
                    searchButton.innerHTML = '<i class="fas fa-search"></i>';
                }
                return;
            } else {
                showAlert('❌ Location found is outside Ireland. Please try an Irish address.', 'error');
                if (searchButton) {
                    searchButton.disabled = false;
                    searchButton.innerHTML = '<i class="fas fa-search"></i>';
                }
                return;
            }
        } else {
            // Handle API error response
            const errorMsg = data.error || 'Location not found';
            showAlert(`❌ ${errorMsg}\n\nTry:\n• Full address (e.g., "Cork Street Dublin 8")\n• Street name with area`, 'error');
            if (searchButton) {
                searchButton.disabled = false;
                searchButton.innerHTML = '<i class="fas fa-search"></i>';
            }
        }
        
    } catch (error) {
        console.error('Geocoding error:', error);
        showAlert('⚠️ Search failed. Please check your connection and try again.', 'error');
        if (searchButton) {
            searchButton.disabled = false;
            searchButton.innerHTML = '<i class="fas fa-search"></i>';
        }
    }
}

function formatAddress(address) {
    if (!address) return null;
    
    const parts = [];
    if (address.house_number) parts.push(address.house_number);
    if (address.road) parts.push(address.road);
    if (address.suburb) parts.push(address.suburb);
    if (address.city || address.town) parts.push(address.city || address.town);
    return parts.join(', ');
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`
        );
        const data = await response.json();
        
        if (data && data.address) {
            const addressInput = document.getElementById('addressInput');
            const formatted = formatAddress(data.address) || data.display_name;
            addressInput.value = formatted;
        }
    } catch (error) {
        console.error('Reverse geocoding error:', error);
    }
}

function useCurrentGPS() {
    if ('geolocation' in navigator) {
        showAlert('📡 Getting GPS location...', 'info');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                addUserMarker(userLocation.lat, userLocation.lng);
                map.setView([userLocation.lat, userLocation.lng], 15);
                updateLocationDisplay();
                reverseGeocode(userLocation.lat, userLocation.lng);
                showAlert('✓ GPS location found!', 'success');
            },
            (error) => {
                showAlert('❌ Could not get GPS location', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        showAlert('GPS not supported', 'error');
    }
}

function addUserMarker(lat, lng) {
    if (userMarker) {
        map.removeLayer(userMarker);
    }

    const userIcon = L.divIcon({
        html: '<div style="background: linear-gradient(135deg, #FC642D 0%, #E8590C 100%); color: white; border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 4px solid white; box-shadow: 0 4px 20px rgba(252, 100, 45, 0.4); font-weight: bold; cursor: move;">📍</div>',
        className: '',
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });

    userMarker = L.marker([lat, lng], { 
        icon: userIcon,
        draggable: true,
        autoPan: true
    }).addTo(map);
    
    userMarker.bindPopup('<div style="text-align: center; font-weight: 600; padding: 8px;"><b>📍 Your Location</b><br><small style="color: #767676;">Drag me anywhere!</small></div>');
    
    userMarker.on('drag', function(e) {
        const position = e.target.getLatLng();
        userLocation = { lat: position.lat, lng: position.lng };
        updateLocationDisplay();
        
        updateSearchVisuals();
    });
    
    userMarker.on('dragend', function(e) {
        const position = e.target.getLatLng();
        reverseGeocode(position.lat, position.lng);
        showAlert('✓ Location updated!', 'success');
    });
}

function updateSearchVisuals() {
    if (searchLines.length > 0) {
        searchLines.forEach(line => map.removeLayer(line));
        searchLines = [];
        
        markers.forEach(marker => {
            const markerLatLng = marker.getLatLng();
            const line = L.polyline([
                [userLocation.lat, userLocation.lng],
                [markerLatLng.lat, markerLatLng.lng]
            ], {
                color: '#222222',
                weight: 3,
                opacity: 0.5,
                dashArray: '8, 8'
            }).addTo(map);
            searchLines.push(line);
        });
    }
    
    if (searchCircle) {
        const radius = searchCircle.getRadius();
        map.removeLayer(searchCircle);
        searchCircle = L.circle([userLocation.lat, userLocation.lng], {
            radius: radius,
            color: '#222222',
            fillColor: '#222222',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);
    }
}

async function loadAllServices() {
    try {
        const response = await fetch(`${API_BASE}/services/`);
        const data = await response.json();
        displayServicesOnMap(data);
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load services', 'error');
    }
}

async function filterByType(type) {
    clearMarkers();
    clearSearchVisuals();
    try {
        const response = await fetch(`${API_BASE}/services/?type=${type}`);
        const data = await response.json();
        displayServicesOnMap(data);
        showAlert(`Showing ${serviceConfig[type].label}s`, 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to filter', 'error');
    }
}

function showAllServices() {
    clearMarkers();
    clearResults();
    clearSearchVisuals();
    loadAllServices();
    showAlert('Showing all services', 'success');
}

function clearAllFilters() {
    clearMarkers();
    clearResults();
    clearSearchVisuals();
    loadAllServices();
    map.setView([userLocation.lat, userLocation.lng], 13);
    showAlert('✓ All filters cleared', 'success');
}

function clearSearchVisuals() {
    searchLines.forEach(line => map.removeLayer(line));
    searchLines = [];
    if (searchCircle) {
        map.removeLayer(searchCircle);
        searchCircle = null;
    }
    clearRoute();
}

async function findNearest() {
    const limit = document.getElementById('nearestLimit').value;
    clearMarkers();
    clearSearchVisuals();
    
    try {
        const response = await fetch(
            `${API_BASE}/services/nearest/?lat=${userLocation.lat}&lng=${userLocation.lng}&limit=${limit}`
        );
        const data = await response.json();
        
        displayServicesOnMap(data.services, false);
        displayResults(data.services, `${data.count} Nearest Services`);
        
        // Draw lines
        data.services.forEach(service => {
            const line = L.polyline([
                [userLocation.lat, userLocation.lng],
                [service.latitude, service.longitude]
            ], {
                color: serviceConfig[service.service_type].color,
                weight: 3,
                opacity: 0.7,
                dashArray: '8, 8'
            }).addTo(map);
            searchLines.push(line);
        });

        showAlert(`✓ Found ${data.count} nearest`, 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('Search failed', 'error');
    }
}

async function searchWithinRadius() {
    const radius = document.getElementById('radiusInput').value;
    clearMarkers();
    clearSearchVisuals();
    
    try {
        const response = await fetch(
            `${API_BASE}/services/within_radius/?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radius}`
        );
        const data = await response.json();
        
        displayServicesOnMap(data.services, false);
        displayResults(data.services, `Within ${radius}km`);
        
        // Draw circle
        searchCircle = L.circle([userLocation.lat, userLocation.lng], {
            radius: radius * 1000,
            color: '#222222',
            fillColor: '#222222',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);

        showAlert(`✓ Found ${data.count} within ${radius}km`, 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('Search failed', 'error');
    }
}

function displayServicesOnMap(services, useClustering = true) {
    clearMarkers();

    const markerBatch = [];
    
    services.forEach(service => {
        const config = serviceConfig[service.service_type];
        
        const customIcon = L.divIcon({
            html: `<div style="background: ${config.color}; color: white; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 3px 12px rgba(0,0,0,0.25);">${config.icon}</div>`,
            className: '',
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });

        const marker = L.marker([service.latitude, service.longitude], {
            icon: customIcon,
            title: service.name
        });

        // Escape service name for use in onclick
        const escapedName = service.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        const popupContent = `
            <div class="popup-content">
                <div class="popup-title">${config.icon} ${service.name}</div>
                <div class="popup-info">
                    <div class="popup-item">
                        <i class="fas fa-tag info-icon"></i>
                        <span>${config.label}</span>
                    </div>
                    <div class="popup-item">
                        <i class="fas fa-map-marker-alt info-icon"></i>
                        <span>${service.address}</span>
                    </div>
                    <div class="popup-item">
                        <i class="fas fa-phone info-icon"></i>
                        <span>${service.phone || 'N/A'}</span>
                    </div>
                    ${service.is_24_hours ? 
                        '<div class="popup-item"><i class="fas fa-clock info-icon"></i><span style="color: #10B981; font-weight: 600;">Open 24 Hours</span></div>' : 
                        '<div class="popup-item"><i class="fas fa-clock info-icon"></i><span style="color: #F59E0B; font-weight: 600;">Limited Hours</span></div>'}
                    ${service.distance ? `<div class="popup-item"><i class="fas fa-route info-icon"></i><span><b>${service.distance.km} km</b> away (as crow flies)</span></div>` : ''}
                </div>
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #EBEBEB;">
                    <button onclick="getRouteToService(${service.latitude}, ${service.longitude}, '${escapedName}')" 
                            class="btn-route" 
                            style="width: 100%; padding: 10px; background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.875rem; transition: all 0.2s ease;">
                        <i class="fas fa-directions"></i> Get Directions
                    </button>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'custom-popup'
        });
        
        marker.on('click', function() {
            map.setView([service.latitude, service.longitude], 16);
        });
        
        markerBatch.push(marker);
    });

    if (useClustering) {
        markerCluster.addLayers(markerBatch);
    } else {
        markerBatch.forEach(marker => {
            marker.addTo(map);
            markers.push(marker);
        });
        
        if (markerBatch.length > 0) {
            const group = L.featureGroup(markers);
            if (userMarker) group.addLayer(userMarker);
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }
}

function displayResults(services, title) {
    const container = document.getElementById('resultsContainer');
    
    if (services.length === 0) {
        container.innerHTML = '<div class="control-section"><div class="alert-custom alert-info"><i class="fas fa-info-circle"></i> No services found</div></div>';
        return;
    }

    let html = `<div class="control-section">
        <div class="section-title">
            <span class="section-icon"><i class="fas fa-list"></i></span>
            ${title}
        </div>
        <div class="results-container">`;
    
    services.forEach(service => {
        const config = serviceConfig[service.service_type];
        const distance = service.distance ? service.distance.km : null;
        
        html += `
            <div class="service-card ${service.service_type}" onclick="focusService(${service.latitude}, ${service.longitude})">
                <div class="service-card-header">
                    <h6 class="service-name">
                        <span class="service-icon">${config.icon}</span>
                        ${service.name}
                    </h6>
                    <span class="service-badge ${service.is_24_hours ? 'badge-24h' : 'badge-limited'}">
                        ${service.is_24_hours ? '24H' : 'Limited'}
                    </span>
                </div>
                <div class="service-info">
                    <div class="info-item">
                        <i class="fas fa-map-marker-alt info-icon"></i>
                        <span>${service.address}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-phone info-icon"></i>
                        <span>${service.phone || 'N/A'}</span>
                    </div>
                    ${distance ? `<span class="distance-badge"><i class="fas fa-route"></i> ${distance} km away</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div></div>';
    container.innerHTML = html;
}

function clearResults() {
    document.getElementById('resultsContainer').innerHTML = '';
}

function focusService(lat, lng) {
    map.setView([lat, lng], 17);
}

async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE}/services/statistics/`);
        const data = await response.json();
        
        // Calculate percentages for visual bars
        const total = data.total_services;
        const hospitalPct = total > 0 ? Math.round((data.by_type.hospitals / total) * 100) : 0;
        const policePct = total > 0 ? Math.round((data.by_type.police_stations / total) * 100) : 0;
        const firePct = total > 0 ? Math.round((data.by_type.fire_stations / total) * 100) : 0;
        const available24hPct = total > 0 ? Math.round((data.available_24_hours / total) * 100) : 0;
        
        const statsHTML = `
            <div class="stat-card stat-total">
                <div class="stat-number">${data.total_services}</div>
                <div class="stat-label">Total Services</div>
                <div class="stat-subtitle">Across Dublin</div>
            </div>
            <div class="stat-card stat-hospital">
                <div class="stat-header">
                    <span class="stat-icon">🏥</span>
                    <div>
                        <div class="stat-number">${data.by_type.hospitals}</div>
                        <div class="stat-label">Hospitals</div>
                    </div>
                </div>
                <div class="stat-bar">
                    <div class="stat-bar-fill" style="width: ${hospitalPct}%; background: #FF385C;"></div>
                </div>
                <div class="stat-percentage">${hospitalPct}%</div>
            </div>
            <div class="stat-card stat-police">
                <div class="stat-header">
                    <span class="stat-icon">👮</span>
                    <div>
                        <div class="stat-number">${data.by_type.police_stations}</div>
                        <div class="stat-label">Police Stations</div>
                    </div>
                </div>
                <div class="stat-bar">
                    <div class="stat-bar-fill" style="width: ${policePct}%; background: #3B82F6;"></div>
                </div>
                <div class="stat-percentage">${policePct}%</div>
            </div>
            <div class="stat-card stat-fire">
                <div class="stat-header">
                    <span class="stat-icon">🚒</span>
                    <div>
                        <div class="stat-number">${data.by_type.fire_stations}</div>
                        <div class="stat-label">Fire Stations</div>
                    </div>
                </div>
                <div class="stat-bar">
                    <div class="stat-bar-fill" style="width: ${firePct}%; background: #F59E0B;"></div>
                </div>
                <div class="stat-percentage">${firePct}%</div>
            </div>
            <div class="stat-card stat-availability">
                <div class="stat-header">
                    <span class="stat-icon">🕐</span>
                    <div>
                        <div class="stat-number">${data.available_24_hours}</div>
                        <div class="stat-label">24/7 Available</div>
                    </div>
                </div>
                <div class="stat-bar">
                    <div class="stat-bar-fill" style="width: ${available24hPct}%; background: #10B981;"></div>
                </div>
                <div class="stat-percentage">${available24hPct}%</div>
            </div>
        `;
        
        document.getElementById('statsContainer').innerHTML = statsHTML;
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('statsContainer').innerHTML = `
            <div class="alert-custom alert-error">
                <i class="fas fa-exclamation-circle"></i> Failed to load statistics
            </div>
        `;
    }
}

function clearMarkers() {
    markerCluster.clearLayers();
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function showAlert(message, type) {
    const alertClass = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-info';
    const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    
    document.querySelectorAll('.alert-custom').forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-custom ${alertClass}`;
    alertDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    
    const container = document.querySelector('.control-panel');
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => alertDiv.remove(), 3500);
}

// Calculate and display route from user location to selected service
async function getRouteToService(destLat, destLng, serviceName) {
    // Check if user location is set
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
        showAlert('Please set your location first', 'error');
        return;
    }
    
    showAlert('🗺️ Calculating route...', 'info');
    
    // Remove any existing route from map
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    
    try {
        // Use OSRM (Open Source Routing Machine) demo server for route calculation
        // Format: start coordinates;end coordinates
        const start = `${userLocation.lng},${userLocation.lat}`;
        const end = `${destLng},${destLat}`;
        
        // Call OSRM API to get driving route
        const url = `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const geometry = route.geometry;
            // Convert distance from meters to kilometers
            const distance = (route.distance / 1000).toFixed(2);
            // Convert duration from seconds to minutes
            const duration = Math.round(route.duration / 60);
            
            // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
            const coordinates = geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            // Draw route as polyline on map
            routeLayer = L.polyline(coordinates, {
                color: '#FF385C',
                weight: 5,
                opacity: 0.8,
                smoothFactor: 1
            }).addTo(map);
            
            // Add popup with route information
            routeLayer.bindPopup(`
                <div style="text-align: center; padding: 8px;">
                    <strong>Route to ${serviceName}</strong><br>
                    <i class="fas fa-route"></i> Distance: <b>${distance} km</b><br>
                    <i class="fas fa-clock"></i> Time: <b>~${duration} min</b>
                </div>
            `).openPopup();
            
            // Adjust map view to show entire route
            map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
            
            showAlert(`✓ Route calculated: ${distance} km (~${duration} min)`, 'success');
        } else {
            // If routing API fails, draw straight line as fallback
            routeLayer = L.polyline([
                [userLocation.lat, userLocation.lng],
                [destLat, destLng]
            ], {
                color: '#FF385C',
                weight: 4,
                opacity: 0.6,
                dashArray: '10, 10' // Dashed line to indicate it's not a real route
            }).addTo(map);
            
            // Calculate straight-line distance using Haversine formula
            const distance = calculateDistance(userLocation.lat, userLocation.lng, destLat, destLng);
            routeLayer.bindPopup(`
                <div style="text-align: center; padding: 8px;">
                    <strong>Direct route to ${serviceName}</strong><br>
                    <i class="fas fa-route"></i> Distance: <b>${distance.toFixed(2)} km</b><br>
                    <small style="color: #767676;">(Straight line - routing unavailable)</small>
                </div>
            `).openPopup();
            
            showAlert(`✓ Direct route: ${distance.toFixed(2)} km`, 'success');
        }
    } catch (error) {
        console.error('Route calculation error:', error);
        
        // If API call fails completely, draw straight line
        routeLayer = L.polyline([
            [userLocation.lat, userLocation.lng],
            [destLat, destLng]
        ], {
            color: '#FF385C',
            weight: 4,
            opacity: 0.6,
            dashArray: '10, 10'
        }).addTo(map);
        
        const distance = calculateDistance(userLocation.lat, userLocation.lng, destLat, destLng);
        showAlert(`✓ Direct route: ${distance.toFixed(2)} km (routing service unavailable)`, 'info');
    }
}

// Calculate distance between two coordinates using Haversine formula
// Returns distance in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    // Convert latitude difference to radians
    const dLat = (lat2 - lat1) * Math.PI / 180;
    // Convert longitude difference to radians
    const dLon = (lon2 - lon1) * Math.PI / 180;
    // Haversine formula: a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    // Calculate angular distance: c = 2 × atan2(√a, √(1−a))
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    // Distance = R × c
    return R * c;
}

function clearRoute() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
}

function copyCoordinates() {
    const coords = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
    navigator.clipboard.writeText(coords).then(() => {
        showAlert('✓ Coordinates copied to clipboard!', 'success');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = coords;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showAlert('✓ Coordinates copied to clipboard!', 'success');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
    document.getElementById('addressInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchAddress();
        }
    });
});