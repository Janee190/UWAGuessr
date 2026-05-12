// map.js - MazeMap Integration

let map;
let guessMarker = null;
let actualMarker = null;
let resultLine = null;
let resizeListenersAttached = false;

const UWA_CAMPUS_ID = 119;
const UWA_CENTER = [115.818, -31.98]; // [lng, lat]
const UWA_DEFAULT_ZOOM = 15;
const UWA_DEFAULT_ZLEVEL = 1;
const RESULT_LINE_SOURCE_ID = 'guess-result-line-source';
const RESULT_LINE_LAYER_ID = 'guess-result-line-layer';

function isMapReady() {
    return !!map;
}

function hideMapLabelsAndIcons() {
    if (!map || typeof map.getStyle !== 'function') return;
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) return;

    const style = map.getStyle();
    if (!style || !Array.isArray(style.layers)) return;

    var hiddenCount = 0;
    style.layers.forEach(function (layer) {
        if (layer.type !== 'symbol') return;
        if (!map.getLayer(layer.id)) return;

        // Symbol layers carry both POI icons and text labels in Mapbox/MazeMap styles.
        try {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
            hiddenCount++;
        } catch (_err) {
            // Ignore transient style update races and continue hiding remaining layers.
        }
    });

    return hiddenCount;
}

// Retry hiding labels up to 5 times (every 400ms) to catch late style updates.
function scheduleLabelHideRetry(attempts) {
    if (!map || attempts <= 0) return;
    setTimeout(function () {
        var hidden = hideMapLabelsAndIcons();
        if (hidden === 0 && typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
            // Style is loaded but no symbol layers found — the style may have just
            // been set. Try again.
            scheduleLabelHideRetry(attempts - 1);
        } else if (hidden === 0 && typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
            scheduleLabelHideRetry(attempts - 1);
        }
    }, 400);
}

function recenterMapView() {
    if (!map) return;

    if (typeof map.stop === 'function') {
        map.stop();
    }

    if (typeof map.jumpTo === 'function') {
        map.jumpTo({
            center: UWA_CENTER,
            zoom: UWA_DEFAULT_ZOOM,
            bearing: 0,
            pitch: 0
        });
    } else {
        if (typeof map.setCenter === 'function') {
            map.setCenter(UWA_CENTER);
        }
        if (typeof map.setZoom === 'function') {
            map.setZoom(UWA_DEFAULT_ZOOM);
        }
        if (typeof map.setBearing === 'function') {
            map.setBearing(0);
        }
        if (typeof map.setPitch === 'function') {
            map.setPitch(0);
        }
    }

    if (typeof map.setZLevel === 'function') {
        map.setZLevel(UWA_DEFAULT_ZLEVEL);
    }

    if (typeof map.resize === 'function') {
        map.resize();
    }
}

function attachResizeHandlers() {
    if (resizeListenersAttached) return;

    const floatingMapContainer = document.querySelector('.floating-map-container');
    if (floatingMapContainer) {
        floatingMapContainer.addEventListener('transitionend', function () {
            if (map) {
                map.resize();
            }
        });
    }

    window.addEventListener('resize', function () {
        if (map) {
            map.resize();
        }
    });

    resizeListenersAttached = true;
}

// Initialize the map centered on UWA
function initMap() {
    if (map) {
        map.remove();
    }

    guessMarker = null;
    actualMarker = null;
    resultLine = null;

    map = new Mazemap.Map({
        container: 'map',
        campuses: UWA_CAMPUS_ID,
        center: UWA_CENTER,
        zoom: UWA_DEFAULT_ZOOM,
        zLevel: UWA_DEFAULT_ZLEVEL,
        scrollZoom: true,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false
    });

    // Hide map loading spinner once the map is ready
    map.once('idle', function () {
        var spinner = document.getElementById('map-spinner');
        if (spinner) spinner.style.display = 'none';
    });

    // Hide labels on every style-related event so they never have a chance to
    // render. These listeners are registered BEFORE 'load' so they catch the
    // initial style loading, not just subsequent updates.
    map.on('styledata', hideMapLabelsAndIcons);
    map.on('idle', hideMapLabelsAndIcons);
    scheduleLabelHideRetry(5);

    map.on('load', function () {
        recenterMapView();
        hideMapLabelsAndIcons();

        map.on('click', function (e) {
            placeGuessMarker(e.lngLat.lat, e.lngLat.lng);
        });
    });

    attachResizeHandlers();

}


function placeGuessMarker(lat, lng) {
    if (!isMapReady() || actualMarker) {
        // If the actual marker is already shown, ignore new guesses until next round
        return;
    }

    if (guessMarker) {
        guessMarker.remove();
    }

    guessMarker = new Mazemap.MazeMarker({
        color: '#ffc107',
        size: 34
    })
        .setLngLat([lng, lat])
        .addTo(map);

    document.getElementById('action-btn').disabled = false;
}

function clearResultLine() {
    if (!map || !resultLine) return;

    if (map.getLayer(RESULT_LINE_LAYER_ID)) {
        map.removeLayer(RESULT_LINE_LAYER_ID);
    }

    if (map.getSource(RESULT_LINE_SOURCE_ID)) {
        map.removeSource(RESULT_LINE_SOURCE_ID);
    }

    resultLine = null;
}

// Show the actual location and draw a line after guessing
function showResultOnMap(guessLat, guessLng, actualLat, actualLng) {
    if (!isMapReady()) return;

    if (actualMarker) {
        actualMarker.remove();
    }

    actualMarker = new Mazemap.MazeMarker({
        color: '#3b3887',
        size: 34
    })
        .setLngLat([actualLng, actualLat])
        .addTo(map);

    clearResultLine();

    if (guessMarker) {
        const resultLineGeoJson = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [guessLng, guessLat],
                    [actualLng, actualLat]
                ]
            }
        };

        map.addSource(RESULT_LINE_SOURCE_ID, {
            type: 'geojson',
            data: resultLineGeoJson
        });

        map.addLayer({
            id: RESULT_LINE_LAYER_ID,
            type: 'line',
            source: RESULT_LINE_SOURCE_ID,
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            },
            paint: {
                'line-color': '#ff3b30',
                'line-width': 3
            }
        });

        resultLine = true;

        const minLng = Math.min(guessLng, actualLng);
        const maxLng = Math.max(guessLng, actualLng);
        const minLat = Math.min(guessLat, actualLat);
        const maxLat = Math.max(guessLat, actualLat);

        var fitDuration = typeof map.loaded === 'function' && !map.loaded() ? 0 : 700;
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: fitDuration });
    } else {
        // If there was no guess, just center on the actual location
        map.setCenter([actualLng, actualLat]);
    }
}

// Reset map for the next round
function clearMapForNextRound() {
    if (guessMarker) {
        guessMarker.remove();
        guessMarker = null;
    }

    if (actualMarker) {
        actualMarker.remove();
        actualMarker = null;
    }

    clearResultLine();

    recenterMapView();
    hideMapLabelsAndIcons();
}