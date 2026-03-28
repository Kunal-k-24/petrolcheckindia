const SUPABASE_URL = 'https://wozsbchxjgtdbuyyvmoi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-qomqSHbC0p4AVNsH2BsRw_h3el8I8v';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let map;
let userMarker;
let pumpMarkers = [];
let userLocation = { lat: 18.5204, lng: 73.8567 }; // Default: Pune
let popunderTriggered = false;

let currentLang = 'en';
const translations = {
    en: {
        title: "Petrol Check",
        subtitle: "Real-time fuel availability near you",
        searchBtn: "Find Nearby Petrol Pumps",
        available: "Available",
        unavailable: "Not Available",
        away: "km away",
        lastUpdated: "Last updated",
        noPumps: "No petrol pumps found in the database.",
        tapDetails: "Tap to view details →",
        youAreHere: "You are here",
        locationError: "Location access denied or unavailable. Defaulting to Pune. You can enable location in settings for better results.",
        requestingLocation: "Requesting location..."
    },
    hi: {
        title: "पेट्रोल चेक",
        subtitle: "आपके पास ईंधन की उपलब्धता की जानकारी",
        searchBtn: "नजदीकी पेट्रोल पंप खोजें",
        available: "उपलब्ध",
        unavailable: "उपलब्ध नहीं",
        away: "किमी दूर",
        lastUpdated: "अंतिम अपडेट",
        noPumps: "डेटाबेस में कोई पेट्रोल पंप नहीं मिला।",
        tapDetails: "विवरण देखने के लिए टैप करें →",
        youAreHere: "आप यहाँ हैं",
        locationError: "स्थान की अनुमति नहीं मिली। पुणे का स्थान दिखाया जा रहा है। बेहतर परिणामों के लिए सेटिंग्स में स्थान सक्षम करें।",
        requestingLocation: "स्थान खोजा जा रहा है..."
    },
    mr: {
        title: "पेट्रोल चेक",
        subtitle: "तुमच्या जवळील इंधन उपलब्धतेची माहिती",
        searchBtn: "जवळील पेट्रोल पंप शोधा",
        available: "उपलब्ध",
        unavailable: "उपलब्ध नाही",
        away: "किमी लांब",
        lastUpdated: "शेवटचे अपडेट",
        noPumps: "डेटाबेसमध्ये कोणतेही पेट्रोल पंप आढळले नाहीत.",
        tapDetails: "तपशील पाहण्यासाठी टॅप करा →",
        youAreHere: "तुम्ही इथे आहात",
        locationError: "स्थान परवानगी नाकारली. पुणे स्थान दाखवले जात आहे. चांगल्या निकालांसाठी सेटिंग्जमध्ये स्थान सक्षम करा.",
        requestingLocation: "स्थान शोधले जात आहे..."
    }
};

function changeLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = translations[lang][key];
    });
    
    // Update active button state
    document.querySelectorAll('.lang-switcher button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${lang}`).classList.add('active');
    
    // Refresh list if data exists
    if (window.lastFetchedPumps) {
        displayPumps(window.lastFetchedPumps);
    }
    
    // Update map marker if it exists
    if (userMarker) {
        userMarker.setPopupContent(translations[lang].youAreHere);
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchPumps(); // Initial load with default location (Pune)
    
    document.getElementById('find-pumps-btn').addEventListener('click', () => {
        triggerPopunder();
        getLocation(); // Request location only on user click
    });

    // Global click listener for popunder on every click
    document.addEventListener('click', () => {
        triggerPopunder();
    }, true);

    // Scroll listener for popunder
    let scrollCount = 0;
    window.addEventListener('scroll', () => {
        scrollCount++;
        if (scrollCount % 100 === 0) { // Trigger every ~100 scroll units
            triggerPopunder();
        }
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

    // Map click trigger
    map.on('click', () => {
        triggerPopunder();
    });

    userMarker = L.marker([userLocation.lat, userLocation.lng]).addTo(map)
        .bindPopup(translations[currentLang].youAreHere).openPopup();
}

function getLocation() {
    if (navigator.geolocation) {
        console.log(translations[currentLang].requestingLocation);
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
                alert(translations[currentLang].locationError);
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
        window.lastFetchedPumps = pumpsWithDistance;
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
        listContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${translations[currentLang].noPumps}</p>`;
        return;
    }

    pumps.forEach((pump, index) => {
        const card = document.createElement('div');
        card.className = 'pump-card';
        card.onclick = () => triggerPopunder();
        
        const statusClass = pump.status === 'available' ? 'status-available' : 'status-unavailable';
        const statusText = pump.status === 'available' ? translations[currentLang].available : translations[currentLang].unavailable;

        card.innerHTML = `
            <div class="pump-header">
                <span class="pump-name">${pump.name}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="pump-details">
                <p>${pump.distance.toFixed(1)} ${translations[currentLang].away}</p>
                <p>${translations[currentLang].lastUpdated}: ${new Date(pump.updated_at).toLocaleString()}</p>
            </div>
            <div style="font-size: 0.75rem; color: var(--primary-color); margin-top: 0.8rem; font-weight: bold; text-align: right; opacity: 0.8;">
                ${translations[currentLang].tapDetails}
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
    console.log('Popunder trigger called');
    
    // Adsterra scripts often need to be injected once and they handle the clicks.
    // If we want it on "every click", we re-inject the script tag frequently.
    
    const oldScript = document.getElementById('adsterra-popunder');
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = 'adsterra-popunder';
    script.src = 'https://pl28986944.profitablecpmratenetwork.com/9b/ef/7e/9bef7eb62804f4492f2665728a408288.js';
    document.body.appendChild(script);
}
