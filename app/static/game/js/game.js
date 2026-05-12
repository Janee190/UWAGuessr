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
const MIN_HFOV = 25;
const MAX_HFOV = 90;
const TIME_LIMIT = 30;
let timerInterval = null;
let timeRemaining = TIME_LIMIT;
let isTimerExpired = false;

// ── Timer Functions ────────────────────────────────────────────────────────

function startTimer() {
    stopTimer();
    isTimerExpired = false;
    timeRemaining = TIME_LIMIT;
    updateTimerDisplay();

    timerInterval = setInterval(function () {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            handleTimerExpiry();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    stopTimer();
    isTimerExpired = false;
    timeRemaining = TIME_LIMIT;
    var el = document.getElementById('timer-display');
    if (el) {
        el.classList.remove('timer-warning', 'timer-danger', 'timer-expired');
    }
    updateTimerDisplay();
}

function updateTimerDisplay() {
    var el = document.getElementById('timer-display');
    if (!el) return;
    el.textContent = timeRemaining;

    el.classList.remove('timer-warning', 'timer-danger', 'timer-expired');

    if (timeRemaining <= 0) {
        el.classList.add('timer-expired');
    } else if (timeRemaining <= 5) {
        el.classList.add('timer-danger');
    } else if (timeRemaining <= 10) {
        el.classList.add('timer-warning');
    }
}

function handleTimerExpiry() {
    if (isTimerExpired) return;
    isTimerExpired = true;
    stopTimer();

    document.getElementById('submit-btn').disabled = true;

    if (guessMarker) {
        submitGuess();
    } else {
        autoSubmitMiss();
    }
}

async function autoSubmitMiss() {
    var submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;

    try {
        var response = await fetch('/api/guess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: 0, lng: 0, id: currentRoundData.id })
        });

        var result = await response.json();
        if (result.error) {
            console.error(result.error);
            submitBtn.disabled = false;
            return;
        }

        var actualLat = result.actual_lat;
        var actualLng = result.actual_lng;

        totalScore += result.score;
        localStorage.setItem('uwa_totalScore', totalScore);

        showResultOnMap(0, 0, actualLat, actualLng);

        var feedbackMsg = "Time's up! You didn't place a marker.";
        if (result.score > 0) {
            feedbackMsg += " Scored " + result.score + " points.";
        } else {
            feedbackMsg += " +0 points.";
        }
        document.getElementById('feedback-text').innerText = feedbackMsg;
        document.getElementById('next-btn').disabled = false;

        currentRoundIndex++;
    } catch (e) {
        console.error('Auto-submit failed:', e);
        submitBtn.disabled = false;
    }
}

// Resets game state and starts the first round.
async function startGame() {
    try {
        const response = await fetch('/api/game-images');
        images = await response.json();
    } catch (e) {
        console.error("Failed to load images:", e);
        return;
    }

    currentRoundIndex = 0;
    totalScore = 0;
    activeRounds = images;
    localStorage.setItem('uwa_totalScore', totalScore); // Reset local storage
    document.getElementById('game-board').style.display = 'block';
    document.getElementById('game-over').style.display = 'none';
    setupPhotoViewer();

    // Show map loading spinner
    var spinner = document.getElementById('map-spinner');
    if (spinner) spinner.style.display = '';

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

    // Start countdown timer for this round
    resetTimer();
    startTimer();
}

// Submits the current map guess, scores it, and unlocks the next round button.
async function submitGuess() {
    if (!guessMarker) return;

    const markerPosition = guessMarker.getLngLat ? guessMarker.getLngLat() : guessMarker.getLatLng();
    const guessLat = markerPosition.lat;
    const guessLng = markerPosition.lng;

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;

    // Stop the timer since the guess was submitted
    stopTimer();

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
    stopTimer();

    document.getElementById('game-board').style.display = 'none';
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').innerText = `Final Score: ${totalScore}`;
    sendGameComplete(totalScore);
}

function sendGameComplete(finalScore) {
    fetch('/api/game-complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ totalScore: finalScore })
    })
        .then((response) => {
            if (!response.ok) {
                return response.json().then((data) => {
                    throw new Error(data?.error || 'Failed to save score');
                });
            }
            return response.json();
        })
        .catch((e) => {
            console.warn('Score save failed:', e.message || e);
        });
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
        panoViewer = null;
    }

    if (!window.UWAPano || typeof window.UWAPano.buildViewer !== 'function') return;

    window.UWAPano.buildViewer('photo-viewer', imageUrl, {
        hfov: DEFAULT_HFOV,
        minHfov: MIN_HFOV,
        maxHfov: MAX_HFOV,
        avoidShowingBackground: true,
        onReady: function (viewer) { panoViewer = viewer; },
    });
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