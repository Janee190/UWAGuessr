// image-upload.js — MazeMap + Pannellum integration with multi-file queue

/** @type {Mazemap.Map} */
let uploadMap = null;
/** @type {maplibregl.Marker|null} */
let locationMarker = null;
/** @type {Pannellum.Viewer|null} */
let panoViewer = null;

// ── Queue state ──────────────────────────────────────────────────────────

let fileQueue = [];
let currentIdx = -1;    // Index of item currently shown in editor
let savingIds = new Set();   // Prevent double-save per item

const UWA_CAMPUS_ID = 119;

// ── MazeMap helpers ──────────────────────────────────────────────────────

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

function placeMarker(lat, lng) {
    if (locationMarker) {
        if (typeof locationMarker.remove === 'function') locationMarker.remove();
        locationMarker = null;
    }

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
            var item = fileQueue[currentIdx];
            if (item) {
                item.lat = pos.lat;
                item.lng = pos.lng;
                updateCoordDisplay(pos.lat, pos.lng);
            }
        });
    } else {
        locationMarker = new Mazemap.MazeMarker({ color: '#ffc107', size: 34 })
            .setLngLat([lng, lat])
            .addTo(uploadMap);
    }

    // Update coords on the current item
    var item = fileQueue[currentIdx];
    if (item) { item.lat = lat; item.lng = lng; }
    updateCoordDisplay(lat, lng);
}

function updateCoordDisplay(lat, lng) {
    var el = document.getElementById('coord-display');
    if (el) el.textContent = 'Lat: ' + lat.toFixed(6) + ', Lng: ' + lng.toFixed(6);
}

// ── Panorama preview ─────────────────────────────────────────────────────

function showPanoramaPreview(imageUrl) {
    if (panoViewer) { panoViewer.destroy(); panoViewer = null; }

    var container = document.getElementById('pano-preview');
    if (!container) return;
    container.style.display = 'block';

    if (!window.UWAPano || typeof window.UWAPano.buildViewer !== 'function') return;

    window.UWAPano.buildViewer('pano-preview', imageUrl, {
        hfov: 85,
        minHfov: 25,
        maxHfov: 90,
        avoidShowingBackground: true,
        onReady: function (viewer) { panoViewer = viewer; },
    });
}

// ── Queue rendering ──────────────────────────────────────────────────────

function renderQueue() {
    var list = document.getElementById('queue-list');
    var counter = document.getElementById('queue-counter');
    if (!list) return;

    if (fileQueue.length === 0) {
        document.getElementById('queue-panel').style.display = 'none';
        return;
    }
    document.getElementById('queue-panel').style.display = 'block';
    if (counter) counter.textContent = fileQueue.length + ' image' + (fileQueue.length !== 1 ? 's' : '');

    list.innerHTML = '';
    fileQueue.forEach(function (item, idx) {
        var div = document.createElement('div');
        div.className = 'queue-item';
        if (idx === currentIdx && item.status !== 'saved') div.classList.add('active');
        if (item.status === 'saved') div.classList.add('saved');
        if (item.status === 'error') div.classList.add('error');

        var num = document.createElement('span');
        num.className = 'queue-item-number';
        num.textContent = idx + 1;
        div.appendChild(num);

        var name = document.createElement('span');
        name.className = 'queue-item-name';
        name.title = item.originalName;
        name.textContent = item.originalName;
        div.appendChild(name);

        var statusEl = document.createElement('span');
        statusEl.className = 'queue-item-status';
        var statusMap = {
            waiting:   '<span class="badge badge-waiting">Waiting</span>',
            uploading: '<span class="badge badge-uploading"><span class="spinner-border spinner-border-sm" style="width:0.65rem;height:0.65rem;margin-right:2px;"></span> Uploading</span>',
            ready:     '<span class="badge badge-ready">Ready</span>',
            saving:    '<span class="badge badge-saving"><span class="spinner-border spinner-border-sm" style="width:0.65rem;height:0.65rem;margin-right:2px;"></span> Saving</span>',
            saved:     '<span class="badge badge-saved">Saved</span>',
            error:     '<span class="badge badge-error">Error</span>',
        };
        statusEl.innerHTML = statusMap[item.status] || item.status;
        div.appendChild(statusEl);

        // Action button
        if (item.status === 'ready' && idx !== currentIdx) {
            var editBtn = document.createElement('button');
            editBtn.className = 'queue-item-action-btn';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', function () { openInEditor(idx); });
            div.appendChild(editBtn);
        } else if (item.status === 'error' && idx !== currentIdx) {
            var retryBtn = document.createElement('button');
            retryBtn.className = 'queue-item-action-btn';
            retryBtn.textContent = 'Retry';
            retryBtn.addEventListener('click', function () { openInEditor(idx); });
            div.appendChild(retryBtn);
        }

        if (item.status === 'error' || item.status === 'saved') {
            var rmBtn = document.createElement('button');
            rmBtn.className = 'queue-item-action-btn remove-btn';
            rmBtn.textContent = 'Remove';
            rmBtn.addEventListener('click', function () { removeFromQueue(idx); });
            div.appendChild(rmBtn);
        }

        list.appendChild(div);
    });

    updateEditorBadge();
    updateRemainingCount();
}

function updateEditorBadge() {
    var badge = document.getElementById('editor-queue-badge');
    if (!badge) return;
    var done = fileQueue.filter(function (i) { return i.status === 'saved'; }).length;
    var total = fileQueue.length;
    badge.textContent = (done + 1) + ' of ' + total;
}

function updateRemainingCount() {
    var el = document.getElementById('queue-remaining');
    if (!el) return;
    var remaining = fileQueue.filter(function (i) { return i.status !== 'saved' && i.status !== 'error'; }).length;
    el.textContent = remaining > 0 ? (remaining + ' remaining') : '';
}

// ── Queue management ─────────────────────────────────────────────────────

function removeFromQueue(idx) {
    var wasCurrent = idx === currentIdx;
    fileQueue.splice(idx, 1);

    if (wasCurrent) {
        destroyEditor();
        currentIdx = -1;
        var next = findNextReady(0);
        if (next !== -1) {
            openInEditor(next);
        } else {
            var anyWaiting = fileQueue.some(function (i) { return i.status === 'waiting' || i.status === 'uploading'; });
            if (!anyWaiting && fileQueue.length > 0) {
                document.getElementById('upload-panel').style.display = 'block';
            }
        }
    } else if (idx < currentIdx) {
        currentIdx--;
    }

    renderQueue();
    if (fileQueue.length === 0) {
        document.getElementById('upload-panel').style.display = 'block';
        document.getElementById('editor-panel').style.display = 'none';
    }
}

function findNextReady(fromIdx) {
    for (var i = fromIdx; i < fileQueue.length; i++) {
        if (fileQueue[i].status === 'ready') return i;
    }
    return -1;
}

function preloadPanoramaForItem(item) {
    if (!item || !item.tempPath || item.preloaded) return;
    var img = new Image();
    img.onload = function () { item.preloaded = true; };
    img.onerror = function () { item.preloaded = true; };
    img.src = '/instance/uploads/' + encodeURIComponent(item.tempPath);
}

function preloadNextReady(fromIdx) {
    var next = findNextReady(fromIdx);
    if (next === -1) next = findNextReady(0);
    if (next !== -1 && next !== currentIdx) {
        preloadPanoramaForItem(fileQueue[next]);
    }
}

function destroyEditor() {
    if (panoViewer) { panoViewer.destroy(); panoViewer = null; }
    if (uploadMap) { uploadMap.remove(); uploadMap = null; locationMarker = null; }
    document.getElementById('pano-preview').style.display = 'none';
    document.getElementById('editor-panel').style.display = 'none';
}

// ── Open item in editor ──────────────────────────────────────────────────

function openInEditor(idx) {
    var item = fileQueue[idx];
    if (!item || (item.status !== 'ready' && item.status !== 'error')) return;

    currentIdx = idx;
    document.getElementById('editor-panel').style.display = 'block';
    document.getElementById('upload-panel').style.display = 'none';
    document.getElementById('file-name').textContent = item.originalName;
    updateCoordDisplay(item.lat, item.lng);
    renderQueue();

    var panoUrl = '/instance/uploads/' + encodeURIComponent(item.tempPath);
    showPanoramaPreview(panoUrl);

    var saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save & Next';
    saveBtn.classList.remove('btn-success');
    saveBtn.classList.add('btn-warning');

    setTimeout(function () { initUploadMap(item.lat, item.lng); }, 300);
    if (item.status === 'error' && item.errorMsg) {
        setStatus('Previous save failed: ' + item.errorMsg + '. Adjust the pin if needed, then click "Save & Next".', true);
    } else {
        setStatus('Adjust the pin if needed, then click "Save & Next".', false);
    }

    preloadNextReady(currentIdx + 1);
}

// ── Upload flow ──────────────────────────────────────────────────────────

async function startUploading() {
    var progressContainer = document.getElementById('upload-progress-container');
    var progressFill = document.getElementById('upload-progress-fill');
    progressContainer.style.display = 'block';

    var waiting = fileQueue.filter(function (i) { return i.status === 'waiting'; });
    var total = waiting.length;
    var completed = 0;

    for (var i = 0; i < waiting.length; i++) {
        var item = waiting[i];
        item.status = 'uploading';
        renderQueue();

        var formData = new FormData();
        formData.append('image', item.file);

        try {
            var resp = await fetch('/api/upload-image', { method: 'POST', body: formData });
            var data = await resp.json();

            if (data.error) {
                item.status = 'error';
                item.errorMsg = data.error;
                renderQueue();
                completed++;
                progressFill.style.width = (completed / total * 100) + '%';
                continue;
            }

            item.status = 'ready';
            item.tempPath = data.tempPath;
            item.lat = data.lat;
            item.lng = data.lng;
            renderQueue();

            if (currentIdx !== -1) {
                preloadNextReady(currentIdx + 1);
            }

            if (currentIdx === -1) {
                openInEditor(fileQueue.indexOf(item));
            }
        } catch (err) {
            item.status = 'error';
            item.errorMsg = err.message;
            renderQueue();
        }

        completed++;
        progressFill.style.width = (completed / total * 100) + '%';
    }

    setTimeout(function () { progressContainer.style.display = 'none'; }, 500);

    if (currentIdx === -1) {
        var firstReady = findNextReady(0);
        if (firstReady !== -1) openInEditor(firstReady);
    }

    var anyUsable = fileQueue.some(function (i) {
        return i.status === 'ready' || i.status === 'waiting' || i.status === 'uploading';
    });
    if (!anyUsable && currentIdx === -1) {
        document.getElementById('upload-panel').style.display = 'block';
    }
}

// ── Status message ───────────────────────────────────────────────────────

function setStatus(msg, isError) {
    var el = document.getElementById('status-message');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mt-2' + (isError ? ' text-danger' : ' text-success');
}

function saveInBackground(item) {
    if (!item || savingIds.has(item.id)) return;
    savingIds.add(item.id);

    fetch('/api/confirm-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tempPath: item.tempPath,
            lat: item.lat,
            lng: item.lng,
        }),
    })
        .then(function (resp) { return resp.json(); })
        .then(function (data) {
            if (data.error) throw new Error(data.error);
            item.status = 'saved';
            item.errorMsg = null;
            renderQueue();
            if (currentIdx === -1) {
                setStatus('Saved as location #' + data.id + '!', false);
            }
        })
        .catch(function (err) {
            item.status = 'error';
            item.errorMsg = err.message;
            renderQueue();
            setStatus('Save failed for ' + item.originalName + ': ' + err.message, true);
        })
        .finally(function () {
            savingIds.delete(item.id);
        });
}

// ── DOMContentLoaded ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    var fileInput = document.getElementById('image-input');
    var uploadZone = document.getElementById('upload-zone');
    var uploadPanel = document.getElementById('upload-panel');
    var editorPanel = document.getElementById('editor-panel');
    var saveBtn = document.getElementById('save-btn');
    var skipBtn = document.getElementById('skip-btn');
    var cancelBtn = document.getElementById('cancel-btn');

    // ── File selection ──
    function addFiles(files) {
        var validExts = ['jpg', 'jpeg', 'png', 'webp'];
        var added = 0;
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var ext = f.name.split('.').pop().toLowerCase();
            if (validExts.indexOf(ext) === -1) continue;
            fileQueue.push({
                id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                file: f,
                originalName: f.name,
                status: 'waiting',
                tempPath: null,
                lat: null,
                lng: null,
                errorMsg: null,
            });
            added++;
        }
        if (added === 0) {
            setStatus('No valid image files found (JPG, PNG, WebP).', true);
            return;
        }
        setStatus('');
        uploadPanel.style.display = 'none';
        renderQueue();
        startUploading();
    }

    // Drag-and-drop
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
                addFiles(e.dataTransfer.files);
            }
        });
        uploadZone.addEventListener('click', function () {
            fileInput.click();
        });
    }

    fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files.length) {
            addFiles(fileInput.files);
            fileInput.value = '';
        }
    });

    // ── Save & Next ──
    saveBtn.addEventListener('click', async function () {
        var item = fileQueue[currentIdx];
        if (!item || item.status !== 'ready') return;

        item.status = 'saving';
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving\u2026';
        renderQueue();
        setStatus('');

        // Read coords from draggable marker
        if (locationMarker && typeof locationMarker.getLngLat === 'function') {
            var pos = locationMarker.getLngLat();
            item.lat = pos.lat;
            item.lng = pos.lng;
        }

        saveInBackground(item);

        destroyEditor();

        // Find next ready item immediately
        var next = findNextReady(currentIdx + 1);
        if (next === -1) next = findNextReady(0);
        if (next !== -1 && next !== currentIdx) {
            openInEditor(next);
        } else {
            currentIdx = -1;
            document.getElementById('upload-panel').style.display = 'block';
            renderQueue();
            var anyWaiting = fileQueue.some(function (i) {
                return i.status === 'waiting' || i.status === 'uploading';
            });
            if (anyWaiting) {
                setStatus('Uploading next image\u2026', false);
            } else if (fileQueue.every(function (i) { return i.status === 'saved'; })) {
                setStatus('All images saved! You can upload more or go play the game.', false);
            }
        }
    });

    // ── Skip ──
    skipBtn.addEventListener('click', function () {
        var item = fileQueue[currentIdx];
        if (!item) return;
        destroyEditor();

        var next = findNextReady(currentIdx + 1);
        if (next === -1) next = findNextReady(0);
        if (next !== -1 && next !== currentIdx) {
            openInEditor(next);
        } else {
            currentIdx = -1;
            document.getElementById('upload-panel').style.display = 'block';
            renderQueue();
        }
        renderQueue();
    });

    // ── Cancel All ──
    cancelBtn.addEventListener('click', function () {
        destroyEditor();
        document.getElementById('upload-panel').style.display = 'block';
        fileQueue = [];
        currentIdx = -1;
        renderQueue();
        setStatus('');
    });
});
