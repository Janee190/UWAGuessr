// image-upload.js — MazeMap + Pannellum integration for the image upload tool

/** @type {Mazemap.Map} */
let uploadMap = null;
/** @type {maplibregl.Marker|Mazemap.MazeMarker|null} */
let locationMarker = null;
/** @type {Pannellum.Viewer|null} */
let panoViewer = null;

let currentTempPath = null;
let currentLat = null;
let currentLng = null;

const UWA_CAMPUS_ID = 119;

// ── Helper: hide MazeMap labels ─────────────────────────────────────────

function hideLabels(map) {
    if (!map || typeof map.getStyle !== 'function') return;
    var style = map.getStyle();
    if (!style || !Array.isArray(style.layers)) return;
    style.layers.forEach(function (layer) {
        if (layer.type !== 'symbol') return;
        if (!map.getLayer(layer.id)) return;
        try { map.setLayoutProperty(layer.id, 'visibility', 'none'); }
        catch (_err) { /* ignore */ }
    });
}

// ── Initialise MazeMap ───────────────────────────────────────────────────

function initUploadMap(lat, lng) {
    var container = document.getElementById('upload-map');
    if (!container) return;

    if (uploadMap) {
        uploadMap.remove();
        uploadMap = null;
        locationMarker = null;
    }

    uploadMap = new Mazemap.Map({
        container: 'upload-map',
        campuses: UWA_CAMPUS_ID,
        center: [lng, lat],
        zoom: 17,
        zLevel: 1,
        scrollZoom: true,
    });

    uploadMap.on('load', function () {
        hideLabels(uploadMap);
        placeMarker(lat, lng);
        uploadMap.on('click', function (e) {
            placeMarker(e.lngLat.lat, e.lngLat.lng);
        });
    });

    uploadMap.on('styledata', function () {
        hideLabels(uploadMap);
    });
}


// ── Marker management ────────────────────────────────────────────────────

function placeMarker(lat, lng) {
    if (locationMarker) {
        if (typeof locationMarker.remove === 'function') {
            locationMarker.remove();
        }
        locationMarker = null;
    }

    // Try maplibregl.Marker for drag support; fallback to MazeMarker.
    if (typeof maplibregl !== 'undefined' && maplibregl.Marker) {
        var el = document.createElement('div');
        el.className = 'upload-pin';
        el.innerHTML =
            '<svg viewBox="0 0 24 36" width="28" height="42">' +
            '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" ' +
            'fill="#ffc107" stroke="#fff" stroke-width="2"/>' +
            '<circle cx="12" cy="12" r="5" fill="#fff"/>' +
            '</svg>';
        el.style.cursor = 'grab';
        el.title = 'Drag to adjust position';

        locationMarker = new maplibregl.Marker({ element: el, draggable: true })
            .setLngLat([lng, lat])
            .addTo(uploadMap);

        locationMarker.on('dragend', function () {
            var pos = locationMarker.getLngLat();
            currentLat = pos.lat;
            currentLng = pos.lng;
            updateCoordDisplay(currentLat, currentLng);
        });
    } else {
        // Fallback: non-draggable MazeMarker (click-to-place still works)
        locationMarker = new Mazemap.MazeMarker({ color: '#ffc107', size: 34 })
            .setLngLat([lng, lat])
            .addTo(uploadMap);
    }

    currentLat = lat;
    currentLng = lng;
    updateCoordDisplay(lat, lng);
}


// ── Coordinate display ───────────────────────────────────────────────────

function updateCoordDisplay(lat, lng) {
    var el = document.getElementById('coord-display');
    if (el) {
        el.textContent = 'Lat: ' + lat.toFixed(6) + ', Lng: ' + lng.toFixed(6);
    }
}


// ── Panorama preview ─────────────────────────────────────────────────────

function showPanoramaPreview(imageUrl) {
    if (panoViewer) {
        panoViewer.destroy();
        panoViewer = null;
    }

    var container = document.getElementById('pano-preview');
    if (!container) return;
    container.style.display = 'block';

    var tempImg = new Image();
    tempImg.onload = function () {
        var haov = 360;
        var vaov = haov * (tempImg.naturalHeight / tempImg.naturalWidth);
        var pitchBuffer = 4;

        panoViewer = pannellum.viewer('pano-preview', {
            type: 'equirectangular',
            panorama: imageUrl,
            haov: haov,
            vaov: vaov,
            vOffset: 0,
            autoLoad: true,
            showControls: false,
            pitch: 0,
            hfov: 85,
            minHfov: 40,
            maxHfov: 90,
            minPitch: -(vaov / 2) + pitchBuffer,
            maxPitch: (vaov / 2) - pitchBuffer,
            compass: false,
            mouseZoom: true,
        });
    };
    tempImg.src = imageUrl;
}


// ── Upload flow ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    var fileInput = document.getElementById('image-input');
    var uploadZone = document.getElementById('upload-zone');
    var processingEl = document.getElementById('processing-indicator');
    var editorPanel = document.getElementById('editor-panel');
    var uploadPanel = document.getElementById('upload-panel');
    var saveBtn = document.getElementById('save-btn');
    var cancelBtn = document.getElementById('cancel-btn');
    var statusMsg = document.getElementById('status-message');

    function setStatus(msg, isError) {
        if (!statusMsg) return;
        statusMsg.textContent = msg;
        statusMsg.className = isError ? 'text-danger mt-2' : 'text-success mt-2';
    }

    // ── Drag-and-drop ──
    if (uploadZone) {
        uploadZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        uploadZone.addEventListener('dragleave', function () {
            uploadZone.classList.remove('drag-over');
        });
        uploadZone.addEventListener('drop', function (e) {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                handleFile(e.dataTransfer.files[0]);
            }
        });
        uploadZone.addEventListener('click', function () {
            fileInput.click();
        });
    }

    fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    // ── Upload handler ──
    async function handleFile(file) {
        var ext = file.name.split('.').pop().toLowerCase();
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            setStatus('Please select an image file (JPG, PNG, WebP).', true);
            return;
        }

        setStatus('');
        uploadPanel.style.display = 'none';
        processingEl.style.display = 'block';

        var formData = new FormData();
        formData.append('image', file);

        try {
            var resp = await fetch('/api/upload-image', { method: 'POST', body: formData });
            var data = await resp.json();

            processingEl.style.display = 'none';

            if (data.error) {
                setStatus(data.error, true);
                uploadPanel.style.display = 'block';
                return;
            }

            currentTempPath = data.tempPath;
            currentLat = data.lat;
            currentLng = data.lng;

            editorPanel.style.display = 'block';
            document.getElementById('file-name').textContent = data.originalName;
            updateCoordDisplay(data.lat, data.lng);

            var panoUrl = '/instance/uploads/' + encodeURIComponent(currentTempPath);
            showPanoramaPreview(panoUrl);

            setTimeout(function () {
                initUploadMap(data.lat, data.lng);
            }, 300);

            setStatus('GPS extracted! Drag the pin or click the map to adjust, then click Save.', false);
        } catch (err) {
            processingEl.style.display = 'none';
            uploadPanel.style.display = 'block';
            setStatus('Upload failed: ' + err.message, true);
        }
    }

    // ── Save ──
    saveBtn.addEventListener('click', async function () {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving\u2026';
        setStatus('');

        try {
            var resp = await fetch('/api/confirm-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tempPath: currentTempPath,
                    lat: currentLat,
                    lng: currentLng,
                }),
            });
            var data = await resp.json();

            if (data.error) {
                setStatus(data.error, true);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Location';
                return;
            }

            setStatus('Image saved! Added as location #' + data.id + '.', false);
            saveBtn.textContent = 'Saved \u2713';
            saveBtn.classList.remove('btn-warning');
            saveBtn.classList.add('btn-success');
            document.getElementById('upload-another-btn').style.display = 'inline-block';
        } catch (err) {
            setStatus('Save failed: ' + err.message, true);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Location';
        }
    });

    // ── Cancel / Upload Another ──
    cancelBtn.addEventListener('click', resetAll);
    document.getElementById('upload-another-btn').addEventListener('click', resetAll);

    function resetAll() {
        if (panoViewer) { panoViewer.destroy(); panoViewer = null; }
        if (uploadMap) { uploadMap.remove(); uploadMap = null; locationMarker = null; }
        editorPanel.style.display = 'none';
        uploadPanel.style.display = 'block';
        var preview = document.getElementById('pano-preview');
        if (preview) preview.style.display = 'none';
        document.getElementById('upload-another-btn').style.display = 'none';
        fileInput.value = '';
        currentTempPath = null;
        currentLat = null;
        currentLng = null;
        setStatus('');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Location';
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-warning');
    }
});
