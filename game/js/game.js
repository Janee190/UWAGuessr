// game.js - Game State, Math, and Logic

let currentRoundIndex = 0;
let totalScore = 0;
let currentRoundData = null;

let photoScale = 1;
let photoOffsetX = 0;
let photoOffsetY = 0;
let isPhotoPanning = false;
let panStartClientX = 0;
let panStartClientY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;
let activePhotoPointerId = null;
let photoViewerInitialized = false;

// Starts the game loop
function startGame() {
    currentRoundIndex = 0;
    totalScore = 0;
    localStorage.setItem('uwa_totalScore', totalScore); // Reset local storage
    document.getElementById('game-board').style.display = 'block';
    document.getElementById('game-over').style.display = 'none';
    setupPhotoViewer();
    initMap();
    loadNextRound();
}

// Loads UI for the next round
function loadNextRound() {
    currentRoundData = getRoundData(currentRoundIndex);
    
    if (!currentRoundData) {
        showGameOver();
        return;
    }

    // Update UI
    document.getElementById('location-image').src = currentRoundData.imagePath;
    document.getElementById('round-counter').innerText = `Round ${currentRoundIndex + 1} / ${getTotalRounds()}`;
    document.getElementById('submit-btn').disabled = true; // Wait for guess
    document.getElementById('next-btn').disabled = true;
    document.getElementById('feedback-text').innerText = '';
    resetPhotoTransform();
    
    clearMapForNextRound();
}

// Triggers when the user clicks the 'Submit Guess' button in HTML
function submitGuess() {
    if (!guessMarker) return;

    const guessLat = guessMarker.getLatLng().lat;
    const guessLng = guessMarker.getLatLng().lng;

    // Calculate Math
    const distanceMeters = calculateHaversine(guessLat, guessLng, currentRoundData.lat, currentRoundData.lng);
    const roundScore = calculateScore(distanceMeters);

    // Update State
    totalScore += roundScore;
    localStorage.setItem('uwa_totalScore', totalScore);

    // Show Map Results
    showResultOnMap(guessLat, guessLng, currentRoundData.lat, currentRoundData.lng);

    // Show UI Feedback (You will need HTML elements for these)
    document.getElementById('feedback-text').innerText = `You were ${Math.round(distanceMeters)}m away! You scored ${roundScore} points.`;
    document.getElementById('submit-btn').disabled = true;
    document.getElementById('next-btn').disabled = false;
    
    // Prepare for next round
    currentRoundIndex++;
}

// The Math: Haversine distance in meters
function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; 
}

// The Curve: Convert meters to points (Max 5000)
function calculateScore(distanceMeters) {
    const maxScore = 5000;
    const dropoffRate = 0.005; // Adjust this to make it harder or easier
    
    if (distanceMeters < 15) return maxScore; // Perfect score buffer
    
    // Exponential decay curve
    const score = maxScore * Math.exp(-dropoffRate * (distanceMeters - 15));
    return Math.max(0, Math.round(score));
}

function showGameOver() {
    document.getElementById('game-board').style.display = 'none';
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').innerText = `Final Score: ${totalScore}`;
}

function setupPhotoViewer() {
    if (photoViewerInitialized) return;

    const photoViewer = document.getElementById('photo-viewer');
    const locationImage = document.getElementById('location-image');

    if (!photoViewer || !locationImage) return;

    photoViewer.addEventListener('wheel', onPhotoWheel, { passive: false });
    photoViewer.addEventListener('pointerdown', onPhotoPointerDown);
    window.addEventListener('pointermove', onPhotoPointerMove);
    window.addEventListener('pointerup', onPhotoPointerUp);
    window.addEventListener('pointercancel', onPhotoPointerUp);

    locationImage.addEventListener('dragstart', function (event) {
        event.preventDefault();
    });
    locationImage.addEventListener('load', resetPhotoTransform);

    photoViewerInitialized = true;
}

function onPhotoWheel(event) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : (1 / 1.12);
    zoomPhoto(factor, event.clientX, event.clientY);
}

function onPhotoPointerDown(event) {
    if (event.button !== 0 || photoScale <= 1) return;

    const locationImage = document.getElementById('location-image');
    if (!locationImage) return;

    isPhotoPanning = true;
    activePhotoPointerId = event.pointerId;
    panStartClientX = event.clientX;
    panStartClientY = event.clientY;
    panStartOffsetX = photoOffsetX;
    panStartOffsetY = photoOffsetY;
    locationImage.classList.add('panning');

    event.preventDefault();
}

function onPhotoPointerMove(event) {
    if (!isPhotoPanning || activePhotoPointerId !== event.pointerId) return;

    photoOffsetX = panStartOffsetX + (event.clientX - panStartClientX);
    photoOffsetY = panStartOffsetY + (event.clientY - panStartClientY);

    clampPhotoOffsets();
    applyPhotoTransform();
}

function onPhotoPointerUp(event) {
    if (!isPhotoPanning || activePhotoPointerId !== event.pointerId) return;

    const locationImage = document.getElementById('location-image');
    if (locationImage) {
        locationImage.classList.remove('panning');
    }

    isPhotoPanning = false;
    activePhotoPointerId = null;
}

function applyPhotoTransform() {
    const locationImage = document.getElementById('location-image');
    if (!locationImage) return;

    if (photoScale <= 1) {
        locationImage.style.cursor = 'zoom-in';
    } else {
        locationImage.style.cursor = isPhotoPanning ? 'grabbing' : 'grab';
    }

    locationImage.style.transform = `translate3d(${photoOffsetX}px, ${photoOffsetY}px, 0) scale(${photoScale})`;
}

function clampPhotoOffsets() {
    const photoViewer = document.getElementById('photo-viewer');
    const locationImage = document.getElementById('location-image');

    if (!photoViewer || !locationImage) return;

    if (photoScale <= 1) {
        photoOffsetX = 0;
        photoOffsetY = 0;
        return;
    }

    const maxX = Math.max(0, ((locationImage.clientWidth * photoScale) - photoViewer.clientWidth) / 2);
    const maxY = Math.max(0, ((locationImage.clientHeight * photoScale) - photoViewer.clientHeight) / 2);

    photoOffsetX = Math.max(-maxX, Math.min(maxX, photoOffsetX));
    photoOffsetY = Math.max(-maxY, Math.min(maxY, photoOffsetY));
}

function zoomPhoto(factor, anchorClientX, anchorClientY) {
    const photoViewer = document.getElementById('photo-viewer');
    const locationImage = document.getElementById('location-image');

    if (!photoViewer || !locationImage || !locationImage.complete) return;

    const previousScale = photoScale;
    const nextScale = Math.max(1, Math.min(5, Number((photoScale * factor).toFixed(3))));

    if (nextScale === previousScale) return;

    const viewerRect = photoViewer.getBoundingClientRect();
    const anchorX = (anchorClientX !== undefined)
        ? (anchorClientX - viewerRect.left - (viewerRect.width / 2))
        : 0;
    const anchorY = (anchorClientY !== undefined)
        ? (anchorClientY - viewerRect.top - (viewerRect.height / 2))
        : 0;

    const scaleRatio = nextScale / previousScale;
    photoOffsetX = (photoOffsetX * scaleRatio) + (anchorX * (1 - scaleRatio));
    photoOffsetY = (photoOffsetY * scaleRatio) + (anchorY * (1 - scaleRatio));
    photoScale = nextScale;

    clampPhotoOffsets();
    applyPhotoTransform();
}

function resetPhotoTransform() {
    photoScale = 1;
    photoOffsetX = 0;
    photoOffsetY = 0;
    isPhotoPanning = false;
    activePhotoPointerId = null;

    const locationImage = document.getElementById('location-image');
    if (locationImage) {
        locationImage.classList.remove('panning');
    }

    applyPhotoTransform();
}

// Initialize on page load
window.onload = startGame;