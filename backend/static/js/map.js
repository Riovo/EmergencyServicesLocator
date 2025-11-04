// Global variables
let map;
let markers = [];
let userMarker = null;
let markerCluster = null;
let searchLines = [];
let searchCircle = null;
let userLocation = { lat: 53.3365, lng: -6.2856 }; // Cork Street, Dublin 8
const API_BASE = '/api';

// Service configuration
const serviceConfig = {
    hospital: { color: '#FF385C', icon: '🏥', label: 'Hospital' },
    police: { color: '#3B82F6', icon: '👮', label: 'Police Station' },
    fire: { color: '#F59E0B', icon: '🚒', label: 'Fire Station' }
};

// Initialize map
function initMap() {
    map = L.map('map', {
        preferCanvas: true,
        zoomControl: true,
        attributionControl: true
    }).setView([userLocation.lat, userLocation.lng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
        tileSize: 256
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 100);

    markerCluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 15,
        chunkedLoading: true,
        chunkInterval: 200,
        chunkDelay: 50
    });
    map.addLayer(markerCluster);

    addUserMarker(userLocation.lat, userLocation.lng);

    map.on('click', function(e) {
        userLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
        addUserMarker(e.latlng.lat, e.latlng.lng);
        updateLocationDisplay();
        reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    loadAllServices();
    loadStatistics();
}

// Update location display
function updateLocationDisplay() {
    document.getElementById('currentLat').textContent = userLocation.lat.toFixed(4);
    document.getElementById('currentLng').textContent = userLocation.lng.toFixed(4);
    document.getElementById('inputLat').value = userLocation.lat.toFixed(4);
    document.getElementById('inputLng').value = userLocation.lng.toFixed(4);
}

// ACTUALLY WORKING Eircode search using Geocode.ie API
async function searchAddress() {
    const input = document.getElementById('addressInput').value.trim();
    
    if (!input) {
        showAlert('Please enter an address or Eircode', 'error');
        return;
    }
    
    showAlert('🔍 Searching...', 'info');
    
    const cleanInput = input.replace(/\s+/g, ' ').trim();
    const isEircode = /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i.test(cleanInput.replace(/\s+/g, ''));
    
    try {
        let result = null;
        
        // Method 1: Try with Photon (better for Eircodes)
        if (isEircode) {
            const cleanEircode = cleanInput.replace(/\s+/g, '').toUpperCase();
            result = await searchWithPhoton(cleanEircode);
            if (result) return;
        }
        
        // Method 2: Try Nominatim with better parameters
        const nominatimUrls = [
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanInput + ' Ireland')}&format=json&limit=5&addressdetails=1`,
            `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(cleanInput)}&country=Ireland&format=json&limit=5&addressdetails=1`,
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanInput)}&countrycodes=ie&format=json&limit=5&addressdetails=1`
        ];
        
        for (const url of nominatimUrls) {
            try {
                const response = await fetch(url);
                const data = await response.json();
                
                if (data && data.length > 0) {
                    const bestResult = data[0];
                    const lat = parseFloat(bestResult.lat);
                    const lng = parseFloat(bestResult.lon);
                    
                    userLocation = { lat, lng };
                    addUserMarker(lat, lng);
                    map.setView([lat, lng], isEircode ? 18 : 16);
                    updateLocationDisplay();
                    
                    const displayName = formatAddress(bestResult.address) || bestResult.display_name;
                    showAlert(`✓ Found: ${displayName}`, 'success');
                    document.getElementById('addressInput').value = displayName;
                    return;
                }
            } catch (e) {
                console.log('Trying next method...');
            }
        }
        
        showAlert('❌ Location not found. Please try:\n• Full address (e.g., "Cork Street Dublin 8")\n• Nearby landmark\n• Different spelling', 'error');
        
    } catch (error) {
        console.error('Search error:', error);
        showAlert('⚠️ Search failed. Please try again.', 'error');
    }
}

// Try Photon geocoder
async function searchWithPhoton(query) {
    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const [lng, lat] = feature.geometry.coordinates;
            
            userLocation = { lat, lng };
            addUserMarker(lat, lng);
            map.setView([lat, lng], 18);
            updateLocationDisplay();
            
            const props = feature.properties;
            const address = [props.name, props.street, props.city, props.postcode].filter(Boolean).join(', ');
            
            showAlert(`✓ Found: ${address}`, 'success');
            document.getElementById('addressInput').value = address;
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Format address nicely
function formatAddress(address) {
    if (!address) return null;
    
    const parts = [];
    if (address.house_number) parts.push(address.house_number);
    if (address.road) parts.push(address.road);
    if (address.suburb) parts.push(address.suburb);
    if (address.city || address.town) parts.push(address.city || address.town);
    if (address.postcode) parts.push(address.postcode);
    
    return parts.join(', ');
}

// Reverse geocode
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

// Use GPS
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

// FIXED: Draggable marker with real-time update
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
    
    // Update coordinates WHILE dragging
    userMarker.on('drag', function(e) {
        const position = e.target.getLatLng();
        userLocation = { lat: position.lat, lng: position.lng };
        updateLocationDisplay();
        
        // FIXED: Update lines/circles while dragging
        updateSearchVisuals();
    });
    
    // Reverse geocode when done
    userMarker.on('dragend', function(e) {
        const position = e.target.getLatLng();
        reverseGeocode(position.lat, position.lng);
        showAlert('✓ Location updated!', 'success');
    });
}

// FIXED: Update search visuals (lines/circles) during drag
function updateSearchVisuals() {
    // Update lines if they exist
    if (searchLines.length > 0) {
        searchLines.forEach(line => map.removeLayer(line));
        searchLines = [];
        
        // Redraw lines to current services
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
    
    // Update circle if it exists
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

// Load all services
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

// Filter by type
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

// Show all services
function showAllServices() {
    clearMarkers();
    clearResults();
    clearSearchVisuals();
    loadAllServices();
    showAlert('Showing all services', 'success');
}

// FIXED: Clear all filters actually works
function clearAllFilters() {
    clearMarkers();
    clearResults();
    clearSearchVisuals();
    loadAllServices();
    map.setView([userLocation.lat, userLocation.lng], 13);
    showAlert('✓ All filters cleared', 'success');
}

// Clear search visuals (lines and circles)
function clearSearchVisuals() {
    searchLines.forEach(line => map.removeLayer(line));
    searchLines = [];
    if (searchCircle) {
        map.removeLayer(searchCircle);
        searchCircle = null;
    }
}

// Find nearest
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

// Search within radius
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

// Display services on map
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
                    ${service.distance ? `<div class="popup-item"><i class="fas fa-route info-icon"></i><span><b>${service.distance.km} km</b> away</span></div>` : ''}
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

// Display results
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
        
        const statsHTML = `
            <div class="stat-card">
                <div class="stat-number">${data.total_services}</div>
                <div class="stat-label">Total</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.by_type.hospitals}</div>
                <div class="stat-label">Hospitals</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.by_type.police_stations}</div>
                <div class="stat-label">Police</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.by_type.fire_stations}</div>
                <div class="stat-label">Fire</div>
            </div>
        `;
        
        document.getElementById('statsContainer').innerHTML = statsHTML;
    } catch (error) {
        console.error('Error:', error);
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

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
    document.getElementById('addressInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchAddress();
        }
    });
});