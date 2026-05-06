// game.js - Game State, Math, and Logic

let currentRoundIndex = 0;
let totalScore = 0;
let currentRoundData = null;
let activeRounds = [];
let allRoundsData = [];

let photoViewerInitialized = false;
let panoViewer = null;
const ROUNDS_PER_GAME = 5;
const DEFAULT_HFOV = 85;
const MIN_HFOV = 40;
const MAX_HFOV = 90;
const MIN_PITCH = -15;
const MAX_PITCH = 15;
const PITCH_EDGE_BUFFER = 4;

// Resets game state and starts the first round.
async function startGame() {
    try {
        const response = await fetch('/api/rounds');
        allRoundsData = await response.json();
    } catch (e) {
        console.error("Failed to load rounds:", e);
        return;
    }

    currentRoundIndex = 0;
    totalScore = 0;
    activeRounds = buildRandomRounds();
    localStorage.setItem('uwa_totalScore', totalScore); // Reset local storage
    document.getElementById('game-board').style.display = 'block';
    document.getElementById('game-over').style.display = 'none';
    setupPhotoViewer();
    initMap();
    loadNextRound();
}

// Chooses a unique random subset of rounds for one game session.
function buildRandomRounds() {
    const totalRounds = allRoundsData.length;
    const roundsToPlay = Math.min(ROUNDS_PER_GAME, totalRounds);
    const indices = Array.from({ length: totalRounds }, (_, index) => index);

    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return indices
        .slice(0, roundsToPlay)
        .map((index) => allRoundsData[index])
        .filter(Boolean);
}

// Loads the next round photo and resets round-specific UI.
function loadNextRound() {
    currentRoundData = activeRounds[currentRoundIndex];

    if (!currentRoundData) {
        showGameOver();
        return;
    }

    // Update UI
    loadPanorama(currentRoundData.imagePath);
    document.getElementById('round-counter').innerText = `Round ${currentRoundIndex + 1} / ${activeRounds.length}`;
    document.getElementById('submit-btn').disabled = true; // Wait for guess
    document.getElementById('next-btn').disabled = true;
    document.getElementById('feedback-text').innerText = '';

    clearMapForNextRound();
}

// Submits the current map guess, scores it, and unlocks the next round button.
async function submitGuess() {
    if (!guessMarker) return;

    const markerPosition = guessMarker.getLngLat ? guessMarker.getLngLat() : guessMarker.getLatLng();
    const guessLat = markerPosition.lat;
    const guessLng = markerPosition.lng;

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;

    // Send guess to backend
    try {
        const response = await fetch('/api/guess', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lat: guessLat,
                lng: guessLng,
                id: currentRoundData.id
            })
        });

        const result = await response.json();
        if (result.error) {
            console.error(result.error);
            submitBtn.disabled = false;
            return;
        }

        const distanceMeters = result.distance;
        const roundScore = result.score;
        const actualLat = result.actual_lat;
        const actualLng = result.actual_lng;

        // Update State
        totalScore += roundScore;
        localStorage.setItem('uwa_totalScore', totalScore);

        // Show Map Results
        showResultOnMap(guessLat, guessLng, actualLat, actualLng);

        // Show UI Feedback (You will need HTML elements for these)
        document.getElementById('feedback-text').innerText = `You were ${Math.round(distanceMeters)}m away! You scored ${roundScore} points.`;
        document.getElementById('submit-btn').disabled = true;
        document.getElementById('next-btn').disabled = false;

        // Prepare for next round
        currentRoundIndex++;
    } catch (e) {
        console.error("Failed to submit guess:", e);
        submitBtn.disabled = false;
    }
}

// Displays the game-over overlay with the final score.
function showGameOver() {
    document.getElementById('game-board').style.display = 'none';
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').innerText = `Final Score: ${totalScore}`;
}

// Ensures the panorama container exists before rounds begin.
function setupPhotoViewer() {
    if (photoViewerInitialized) return;

    const photoViewer = document.getElementById('photo-viewer');
    if (!photoViewer) return;

    photoViewerInitialized = true;
}

function loadPanorama(imageUrl) {
    // If a viewer already exists, destroy it first
    if (panoViewer !== null) {
        panoViewer.destroy();
    }

    // Create a temporary hidden image to read the true dimensions
    const tempImg = new Image();

    // Wait for the image to load in the background so we get accurate dimensions
    tempImg.onload = function () {

        // Calculate the correct vertical angle of view (vaov) based on aspect ratio
        // We assume your panoramas are a full 360 degrees horizontally
        const haov = 360;
        const vaov = haov * (tempImg.naturalHeight / tempImg.naturalWidth);
        const minPitchLimit = -(vaov / 2) + PITCH_EDGE_BUFFER;
        const maxPitchLimit = (vaov / 2) - PITCH_EDGE_BUFFER;

        // Now initialize Pannellum using the exact geometry of the image
        panoViewer = pannellum.viewer('photo-viewer', {
            "type": "equirectangular",
            "panorama": imageUrl,

            // The Magic Fix: Explicitly tell Pannellum the image dimensions
            "haov": haov,
            "vaov": vaov,
            "vOffset": 0, // Keeps it perfectly centered horizontally

            "autoLoad": true,
            "showControls": false,

            // Lock the vertical pitch so they can't look into the black void
            "minPitch": minPitchLimit,
            "maxPitch": maxPitchLimit,
            "pitch": 0,

            "hfov": DEFAULT_HFOV,
            "minHfov": MIN_HFOV,
            "maxHfov": MAX_HFOV,

            "compass": false,
            "mouseZoom": true
        });
    };

    // Trigger the load
    tempImg.src = imageUrl;
}

// Handles +/- zoom controls by converting scale into Pannellum field-of-view.
function zoomPhoto(scaleFactor) {
    if (!panoViewer) return;

    const currentFov = panoViewer.getHfov();
    const nextFov = Math.max(MIN_HFOV, Math.min(MAX_HFOV, currentFov / scaleFactor));
    panoViewer.setHfov(nextFov);
}

// Resets pitch, yaw, and zoom to the default view.
function resetPhotoTransform() {
    if (!panoViewer) return;

    panoViewer.setPitch(0);
    panoViewer.setYaw(0);
    panoViewer.setHfov(DEFAULT_HFOV);
}

// Initialize on page load
window.onload = startGame;