const SUPABASE_URL = 'https://wozsbchxjgtdbuyyvmoi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-qomqSHbC0p4AVNsH2BsRw_h3el8I8v';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let map;
let userMarker;
let pumpMarkers = [];
let userLocation = { lat: 18.5204, lng: 73.8567 }; // Default: Pune
let popunderTriggered = false;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchPumps(); // Initial load with default location (Pune)
    
    document.getElementById('find-pumps-btn').addEventListener('click', () => {
        triggerPopunder();
        getLocation(); // Request location only on user click
    });
});

function initMap() {
    map = L.map('map').setView([userLocation.lat, userLocation.lng], 13);
    // Using CartoDB Positron tiles which are cleaner and more permissive
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    userMarker = L.marker([userLocation.lat, userLocation.lng]).addTo(map)
        .bindPopup('You are here').openPopup();
}

function getLocation() {
    if (navigator.geolocation) {
        console.log('Requesting location...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('Location granted:', position.coords.latitude, position.coords.longitude);
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                updateMapCenter();
                fetchPumps();
            },
            (error) => {
                console.error('Location error:', error.message);
                alert('Location access denied or unavailable. Defaulting to Pune. You can enable location in settings for better results.');
                fetchPumps();
            },
            {
                enableHighAccuracy: false, // Use cellular/wifi for faster lock
                timeout: 10000,           // Increased to 10 seconds
                maximumAge: 60000         // Allow 1-minute old cached location
            }
        );
    } else {
        console.log('Geolocation not supported');
        fetchPumps();
    }
}

function updateMapCenter() {
    map.setView([userLocation.lat, userLocation.lng], 13);
    userMarker.setLatLng([userLocation.lat, userLocation.lng]);
}

async function fetchPumps() {
    try {
        console.log('Fetching pumps for location:', userLocation);
        const { data, error } = await _supabase
            .from('petrol_pumps')
            .select('*');

        if (error) throw error;
        
        console.log('Total pumps found in DB:', data.length);

        // Sort pumps by distance
        const pumpsWithDistance = data.map(pump => ({
            ...pump,
            distance: calculateDistance(userLocation.lat, userLocation.lng, pump.latitude, pump.longitude)
        })).sort((a, b) => a.distance - b.distance);

        // Filter to nearby (e.g., within 50km) or just show all sorted by distance
        displayPumps(pumpsWithDistance);
        updatePumpMarkers(pumpsWithDistance);
    } catch (err) {
        console.error('Error fetching pumps:', err);
    }
}

function displayPumps(pumps) {
    const listContainer = document.getElementById('pump-list');
    listContainer.innerHTML = '';

    if (pumps.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">No petrol pumps found in the database.</p>';
        return;
    }

    pumps.forEach((pump, index) => {
        // Native Ad Placement every 3 items
        if (index > 0 && index % 3 === 0) {
            const adDiv = document.createElement('div');
            adDiv.className = 'native-ad';
            adDiv.innerHTML = '<p>Advertisement</p>';
            listContainer.appendChild(adDiv);
        }

        const card = document.createElement('div');
        card.className = 'pump-card';
        card.onclick = () => triggerPopunder();
        
        const statusClass = pump.status === 'available' ? 'status-available' : 'status-unavailable';
        const statusText = pump.status === 'available' ? 'Available' : 'Not Available';

        card.innerHTML = `
            <div class="pump-header">
                <span class="pump-name">${pump.name}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="pump-details">
                <p>${pump.distance.toFixed(1)} km away</p>
                <p>Last updated: ${new Date(pump.updated_at).toLocaleString()}</p>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function updatePumpMarkers(pumps) {
    pumpMarkers.forEach(m => map.removeLayer(m));
    pumpMarkers = [];

    pumps.forEach(pump => {
        const color = pump.status === 'available' ? 'green' : 'red';
        const marker = L.circleMarker([pump.latitude, pump.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            radius: 8
        }).addTo(map).bindPopup(`${pump.name}: ${pump.status}`);
        pumpMarkers.push(marker);
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; 
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

function triggerPopunder() {
    if (!popunderTriggered) {
        console.log('Popunder triggered (Adsterra)');
        // In a real scenario, this would be the Adsterra script execution
        // window.open('https://adsterra-url.com', '_blank');
        popunderTriggered = true;
    }
}
