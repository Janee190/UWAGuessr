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

        if (typeof map !== 'undefined' && map) map.resize();
        focusResultOnMap(0, 0, actualLat, actualLng);

        document.getElementById('result-message').innerText = "Time's up! No marker placed.";
        document.getElementById('result-distance').innerText = "-";
        document.getElementById('result-points').innerText = `+${result.score} points`;
        document.getElementById('result-total').innerText = `Total Score: ${totalScore}`;

        let isLastRound = currentRoundIndex === activeRounds.length - 1;
        document.getElementById('next-btn-text').innerText = isLastRound ? "FINISH GAME" : "CONTINUE";
        document.getElementById('next-round-btn').disabled = false;

        if (challengeId) {
            updateProgress(currentRoundIndex + 1, totalScore);
        }

        actionBtn.innerText = "NEXT ROUND";
        actionBtn.disabled = true; // keep hidden actionBtn disabled

        currentRoundIndex++;
        if (currentRoundIndex < activeRounds.length) {
            loadPanorama(activeRounds[currentRoundIndex].imagePath);
        }
    } catch (e) {
        console.error('Auto-submit failed:', e);
        actionBtn.disabled = false;
    }
}

let challengeId = null;
let challengeData = null;
let pollInterval = null;
let challengeTimerInterval = null;
let challengeTimeLeft = 180; // 3 minutes
let gameCompleteSent = false;  // guards against double-posting on refresh

// ── Challenge Logic ────────────────────────────────────────────────────────

function getChallengeIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('challengeId');
}

async function initChallenge() {
    challengeId = getChallengeIdFromUrl();
    if (!challengeId) return;

    // ── Check if this challenge has already been played or finished ──
    try {
        const resp = await fetch(`/api/challenges/poll/${challengeId}`);
        const challenge = await resp.json();
        challengeData = challenge;

        const isChallenger = challenge.challenger_id === window.current_user_id;
        const myScore = isChallenger ? challenge.challenger_score : challenge.challenged_score;

        if (challenge.status === 'completed' || myScore !== null) {
            // Player already finished — restore the game-over screen
            totalScore = myScore || 0;
            showGameOver();
            return 'completed';
        }
    } catch (e) {
        console.error("Failed to check initial challenge status:", e);
    }

    document.getElementById('challenge-info').style.display = 'block';
    document.getElementById('challenge-waiting-room').style.display = 'block';
    document.getElementById('game-status-text').innerText = 'Starting challenge...';

    startChallengeTimer();
    startPolling();
}

function startChallengeTimer() {
    const display = document.getElementById('challenge-timer');
    challengeTimerInterval = setInterval(() => {
        challengeTimeLeft--;
        if (challengeTimeLeft <= 0) {
            clearInterval(challengeTimerInterval);
            alert("Challenge expired!");
            window.location.href = '/dashboard';
            return;
        }
        const mins = Math.floor(challengeTimeLeft / 60);
        const secs = challengeTimeLeft % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function startPolling() {
    pollInterval = setInterval(async () => {
        try {
            const resp = await fetch(`/api/challenges/poll/${challengeId}`);
            challengeData = await resp.json();

            // Safety: if this player finished while polling (e.g. page refresh
            // mid-game but after scoring), jump straight to the completion screen.
            const isChallenger = challengeData.challenger_id === window.current_user_id;
            const myScore = isChallenger ? challengeData.challenger_score : challengeData.challenged_score;
            if (challengeData.status === 'completed' || myScore !== null) {
                clearInterval(pollInterval);
                clearInterval(challengeTimerInterval);
                totalScore = myScore || 0;
                showGameOver();
                return;
            }

            updateChallengeUI();

            if (challengeData.status === 'in_progress') {
                clearInterval(pollInterval);
                clearInterval(challengeTimerInterval);

                // ── Synchronised 3‑2‑1 countdown ─────────────────────
                var startBtnText = document.getElementById('start-btn-text');
                var startBtn = document.getElementById('btn-start-game');
                if (startBtn) startBtn.disabled = true;

                var count = 3;
                startBtnText.innerText = 'Starting in ' + count + '...';
                var countInterval = setInterval(function () {
                    count--;
                    if (count > 0) {
                        startBtnText.innerText = 'Starting in ' + count + '...';
                    } else {
                        clearInterval(countInterval);
                        beginGame();
                    }
                }, 1000);
            } else if (challengeData.status === 'expired') {
                clearInterval(pollInterval);
                alert("This challenge has expired.");
                window.location.href = '/dashboard';
            }
        } catch (e) {
            console.error("Polling failed", e);
        }
    }, 3000);
}

function updateChallengeUI() {
    if (!challengeData) return;
    
    const isChallenger = challengeData.challenger_id === window.current_user_id;
    const opponentName = isChallenger ? challengeData.challenged_username : challengeData.challenger_username;
    const opponentReady = isChallenger ? challengeData.challenged_ready : challengeData.challenger_ready;
    const myReady = isChallenger ? challengeData.challenger_ready : challengeData.challenged_ready;

    document.getElementById('opponent-name').innerText = opponentName;
    
    const statusEl = document.getElementById('opponent-status');
    if (!myReady) {
        statusEl.innerText = "Click 'READY' when you are prepared.";
    } else if (opponentReady) {
        statusEl.innerText = "Both players ready! Starting...";
    } else {
        statusEl.innerText = `Waiting for ${opponentName} to click Ready...`;
    }
}

async function handleStartClick() {
    if (challengeId) {
        const startBtn = document.getElementById('btn-start-game');
        const startBtnText = document.getElementById('start-btn-text');
        
        startBtn.disabled = true;
        startBtnText.innerText = "Waiting on other player...";

        await fetch('/api/challenges/ready', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: challengeId })
        });
    } else {
        beginGame();
    }
}

// Resets game state and starts the first round.
async function startGame() {
    var challengeResult = await initChallenge();
    if (challengeResult === 'completed') return; // already finished — don't reinitialise

    try {
        const url = challengeId ? `/api/game-images?challengeId=${challengeId}` : '/api/game-images';
        const response = await fetch(url);
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

    var overlay = document.getElementById('game-start-overlay');
    overlay.classList.remove('ready');
    overlay.style.display = 'flex';

    setupPhotoViewer();

    // Show map loading spinner
    var spinner = document.getElementById('map-spinner');
    if (spinner) spinner.style.display = '';

    initMap();
    loadPanorama(activeRounds[0].imagePath);
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
    document.getElementById('round-counter').innerText = `Round ${currentRoundIndex + 1} / ${activeRounds.length}`;

    if (challengeId) {
        updateProgress(currentRoundIndex + 1, totalScore);
    }

    const actionBtn = document.getElementById('action-btn');
    actionBtn.innerText = "SUBMIT GUESS";
    actionBtn.disabled = true; // Wait for guess

    document.getElementById('next-round-btn').disabled = true;

    document.getElementById('game-board').classList.remove('show-results');

    // Force a synchronous DOM reflow so the map container immediately adopts the 
    // small dimensions before we tell Mapbox to resize and recenter.
    void document.getElementById('map').offsetWidth;

    if (typeof map !== 'undefined' && map) map.resize();

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

        if (typeof map !== 'undefined' && map) map.resize();
        focusResultOnMap(guessLat, guessLng, actualLat, actualLng);

        let distanceMsg = Math.round(distanceMeters) + " m";
        if (distanceMeters > 1000) {
            distanceMsg = (distanceMeters / 1000).toFixed(1) + " km";
        }

        let resultTitle = "Good guess!";
        if (distanceMeters < 10) resultTitle = "Perfect! Right on top of it.";
        else if (distanceMeters < 50) resultTitle = "Excellent guess! Very close.";
        else if (distanceMeters < 200) resultTitle = "Great guess!";
        else if (distanceMeters < 500) resultTitle = "Not bad!";
        else resultTitle = "At least it was on the correct planet.";

        document.getElementById('result-message').innerText = resultTitle;
        document.getElementById('result-distance').innerText = distanceMsg;
        document.getElementById('result-points').innerText = `+${roundScore} points`;
        document.getElementById('result-total').innerText = `Total Score: ${totalScore}`;

        let isLastRound = currentRoundIndex === activeRounds.length - 1;
        document.getElementById('next-btn-text').innerText = isLastRound ? "FINISH GAME" : "CONTINUE";
        document.getElementById('next-round-btn').disabled = false;

        if (challengeId) {
            updateProgress(currentRoundIndex + 1, totalScore);
        }

        actionBtn.innerText = "NEXT ROUND";
        actionBtn.disabled = true; // keep hidden actionBtn disabled

        // Prepare for next round
        currentRoundIndex++;
        if (currentRoundIndex < activeRounds.length) {
            loadPanorama(activeRounds[currentRoundIndex].imagePath);
        }
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
    
    if (challengeId) {
        pollInterval = setInterval(async () => {
            try {
                const resp = await fetch(`/api/challenges/poll/${challengeId}`);
                challengeData = await resp.json();
                
                const isChallenger = challengeData.challenger_id === window.current_user_id;
                const opponentScore = isChallenger ? challengeData.challenged_score : challengeData.challenger_score;
                
                let resultText = `Your Score: ${totalScore}`;
                if (opponentScore !== null) {
                    if (totalScore > opponentScore) resultText += ` vs Opponent: ${opponentScore} - YOU WIN!`;
                    else if (totalScore < opponentScore) resultText += ` vs Opponent: ${opponentScore} - YOU LOST!`;
                    else resultText += ` vs Opponent: ${opponentScore} - IT'S A TIE!`;
                    clearInterval(pollInterval);
                } else {
                    resultText += " - Waiting for opponent to finish...";
                }
                document.getElementById('final-score').innerText = resultText;
            } catch (e) {
                console.error("GameOver polling failed", e);
            }
        }, 3000);
    } else {
        document.getElementById('final-score').innerText = `Final Score: ${totalScore}`;
    }
    
    sendGameComplete(totalScore);
}

function sendGameComplete(finalScore) {
    if (gameCompleteSent) return;
    gameCompleteSent = true;

    const body = { totalScore: finalScore };
    if (challengeId) body.challengeId = challengeId;

    fetch('/api/game-complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
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

async function updateProgress(roundNum, score) {
    if (!challengeId) return;
    try {
        await fetch('/api/challenges/update-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: challengeId, round: roundNum, score: score })
        });
    } catch (e) {
        console.error("Progress update failed", e);
    }
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