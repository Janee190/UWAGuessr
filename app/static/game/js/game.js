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
const TIME_LIMIT = 20;
let timerInterval = null;
let timeRemaining = TIME_LIMIT;
let isTimerExpired = false;

// ── Timer Functions ────────────────────────────────────────────────────────

let startTime = null;

function startTimer() {
    stopTimer();
    isTimerExpired = false;
    timeRemaining = TIME_LIMIT;
    startTime = performance.now();
    updateTimerDisplay();

    timerInterval = setInterval(function () {
        let elapsedTime = (performance.now() - startTime) / 1000;
        timeRemaining = Math.max(0, TIME_LIMIT - elapsedTime);
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            handleTimerExpiry();
        }
    }, 10);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    var dangerOverlay = document.getElementById('danger-overlay');
    if (dangerOverlay) dangerOverlay.classList.remove('flash');
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
    el.textContent = timeRemaining.toFixed(1) + "s";

    el.classList.remove('timer-warning', 'timer-danger', 'timer-expired');

    var divider = document.getElementById('stats-divider');
    if (divider) divider.classList.remove('timer-warning', 'timer-danger', 'timer-expired');

    var dangerOverlay = document.getElementById('danger-overlay');

    if (timeRemaining <= 0) {
        el.classList.add('timer-expired');
        if (divider) {
            divider.classList.add('timer-bar-active', 'timer-expired');
            divider.style.width = "0%";
        }
        if (dangerOverlay) dangerOverlay.classList.remove('flash');
    } else if (timeRemaining <= 10) {
        if (timeRemaining <= 5) {
            el.classList.add('timer-danger');
            if (divider) divider.classList.add('timer-danger');
            if (dangerOverlay) dangerOverlay.classList.add('flash');
        } else {
            el.classList.add('timer-warning');
            if (divider) divider.classList.add('timer-warning');
            if (dangerOverlay) dangerOverlay.classList.remove('flash');
        }
        if (divider) {
            divider.classList.add('timer-bar-active');
            divider.style.width = ((timeRemaining / 10) * 100) + "%";
        }
    } else {
        if (divider) {
            divider.classList.remove('timer-bar-active');
            divider.style.width = "100%";
        }
        if (dangerOverlay) dangerOverlay.classList.remove('flash');
    }
}

function handleTimerExpiry() {
    if (isTimerExpired) return;
    isTimerExpired = true;
    stopTimer();

    document.getElementById('action-btn').disabled = true;

    if (guessMarker) {
        submitGuess();
    } else {
        autoSubmitMiss();
    }
}

async function autoSubmitMiss() {
    var actionBtn = document.getElementById('action-btn');
    actionBtn.disabled = true;

    try {
        var response = await fetch('/api/guess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: 0, lng: 0, id: currentRoundData.id })
        });

        var result = await response.json();
        if (result.error) {
            console.error(result.error);
            actionBtn.disabled = false;
            return;
        }

        var actualLat = result.actual_lat;
        var actualLng = result.actual_lng;

        totalScore += result.score;
        localStorage.setItem('uwa_totalScore', totalScore);

        drawResultOnMap(0, 0, actualLat, actualLng);

        document.getElementById('game-board').classList.add('show-results');
        
        let start = performance.now();
        requestAnimationFrame(function animateResize(time) {
            if (typeof map !== 'undefined' && map) map.resize();
            if (time - start < 550) {
                requestAnimationFrame(animateResize);
            } else {
                focusResultOnMap(0, 0, actualLat, actualLng);
            }
        });

        document.getElementById('result-message').innerText = "Time's up! No marker placed.";
        document.getElementById('result-distance').innerText = "-";
        document.getElementById('result-points').innerText = `You scored ${result.score} points. Total: ${totalScore}`;

        document.getElementById('next-round-btn').disabled = false;
        actionBtn.innerText = "NEXT ROUND";
        actionBtn.disabled = true; // keep hidden actionBtn disabled

        currentRoundIndex++;
    } catch (e) {
        console.error('Auto-submit failed:', e);
        actionBtn.disabled = false;
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
    document.getElementById('game-start-overlay').style.display = 'flex';
    setupPhotoViewer();

    // Show map loading spinner
    var spinner = document.getElementById('map-spinner');
    if (spinner) spinner.style.display = '';

    initMap();
    loadNextRound(false);
}

function beginGame() {
    document.getElementById('game-start-overlay').style.display = 'none';
    startTimer();
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
function loadNextRound(startTimerImmediately = true) {
    currentRoundData = activeRounds[currentRoundIndex];

    if (!currentRoundData) {
        showGameOver();
        return;
    }

    // Update UI
    loadPanorama(currentRoundData.imagePath);
    document.getElementById('round-counter').innerText = `Round ${currentRoundIndex + 1} / ${activeRounds.length}`;

    const actionBtn = document.getElementById('action-btn');
    actionBtn.innerText = "SUBMIT GUESS";
    actionBtn.disabled = true; // Wait for guess
    
    document.getElementById('next-round-btn').disabled = true;

    document.getElementById('game-board').classList.remove('show-results');
    setTimeout(() => { if (typeof map !== 'undefined' && map) map.resize(); }, 50);
    setTimeout(() => { if (typeof map !== 'undefined' && map) map.resize(); }, 400);

    clearMapForNextRound();

    // Start countdown timer for this round
    resetTimer();
    if (startTimerImmediately) {
        startTimer();
    }
}

// Submits the current map guess, scores it, and unlocks the next round button.
async function submitGuess() {
    if (!guessMarker) return;

    const markerPosition = guessMarker.getLngLat ? guessMarker.getLngLat() : guessMarker.getLatLng();
    const guessLat = markerPosition.lat;
    const guessLng = markerPosition.lng;

    const actionBtn = document.getElementById('action-btn');
    actionBtn.disabled = true;

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
            actionBtn.disabled = false;
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
        drawResultOnMap(guessLat, guessLng, actualLat, actualLng);

        document.getElementById('game-board').classList.add('show-results');
        
        let start = performance.now();
        requestAnimationFrame(function animateResize(time) {
            if (typeof map !== 'undefined' && map) map.resize();
            if (time - start < 550) {
                requestAnimationFrame(animateResize);
            } else {
                focusResultOnMap(guessLat, guessLng, actualLat, actualLng);
            }
        });

        let distanceMsg = Math.round(distanceMeters) + " m";
        if (distanceMeters > 1000) {
            distanceMsg = (distanceMeters / 1000).toFixed(1) + " km";
        }

        let resultTitle = "Good guess!";
        if (distanceMeters < 50) resultTitle = "Perfect! Right on top of it.";
        else if (distanceMeters < 200) resultTitle = "Great guess!";
        else if (distanceMeters < 500) resultTitle = "Not bad!";
        else resultTitle = "At least it was on the correct planet.";

        document.getElementById('result-message').innerText = resultTitle;
        document.getElementById('result-distance').innerText = distanceMsg;
        document.getElementById('result-points').innerText = `You scored ${roundScore} points. Total: ${totalScore}`;

        document.getElementById('next-round-btn').disabled = false;
        
        actionBtn.innerText = "NEXT ROUND";
        actionBtn.disabled = true; // keep hidden actionBtn disabled

        // Prepare for next round
        currentRoundIndex++;
    } catch (e) {
        console.error("Failed to submit guess:", e);
        actionBtn.disabled = false;
    }
}

function handleAction() {
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn.innerText === "SUBMIT GUESS") {
        submitGuess();
    } else {
        loadNextRound();
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