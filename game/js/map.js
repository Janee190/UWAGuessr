// map.js - Leaflet Map Integration

let map;
let guessMarker = null;
let actualMarker = null;
let resultLine = null;
const greenIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Initialize the map centered on UWA
function initMap() {
    // UWA roughly centered at -31.980, 115.818
    map = L.map('map').setView([-31.980, 115.818], 16);

/*     // OpenStreetMap tiles (Free, no API key needed for MVP)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map); */

// CARTO Voyager (Colorful but clean, no API key)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 14,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    // Listen for clicks to place a guess
    map.on('click', function(e) {
        placeGuessMarker(e.latlng.lat, e.latlng.lng);
    });
}

function placeGuessMarker(lat, lng) {
    if (actualMarker) {
        // If the actual marker is already shown, ignore new guesses until next round
        return;
    }
    if (guessMarker) {
        map.removeLayer(guessMarker);
    }
    guessMarker = L.marker([lat, lng], {icon: redIcon}).addTo(map);
    
    // Enable the submit button in your HTML once a marker is placed
    document.getElementById('submit-btn').disabled = false;
}

// Show the actual location and draw a line after guessing
function showResultOnMap(guessLat, guessLng, actualLat, actualLng) {
    // Drop actual marker with green color
    actualMarker = L.marker([actualLat, actualLng], {icon: greenIcon}).addTo(map);
    
    // Draw connecting line
    resultLine = L.polyline([
        [guessLat, guessLng],
        [actualLat, actualLng]
    ], {color: 'red', weight: 3}).addTo(map);

    // Zoom map to fit both markers
    map.fitBounds(resultLine.getBounds(), { padding: [50, 50] });
}

// Reset map for the next round
function clearMapForNextRound() {
    if (guessMarker) map.removeLayer(guessMarker);
    if (actualMarker) {
        map.removeLayer(actualMarker);
        actualMarker = null;}
    if (resultLine) map.removeLayer(resultLine);
    
    guessMarker = null;
    map.setView([-31.980, 115.818], 16); // Reset view back to UWA campus
}