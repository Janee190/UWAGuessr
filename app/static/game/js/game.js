// game.js - Game State, Math, and Logic

window.DEBUG = false;

let currentRoundIndex = 0;
let totalScore = 0;
let currentRoundData = null;
let activeRounds = [];

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
let isSubmitting = false;

function getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
// ── Helpers ─────────────────────────────────────────────────────────────────

function setActionState(btn, action, text) {
    btn.setAttribute('data-action', action);
    btn.disabled = true;
    var span = btn.querySelector('.btn-action-text');
    if (span) span.textContent = text;
}

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
    }, 50);
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
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
            body: JSON.stringify({ lat: 0, lng: 0, id: currentRoundData.id })
        });

        var result = await response.json();
        if (result.error) {
            if (window.DEBUG) console.error(result.error);
            actionBtn.disabled = false;
            return;
        }

        var actualLat = result.actual_lat;
        var actualLng = result.actual_lng;

        totalScore += result.score;

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

        setActionState(actionBtn, 'next', 'NEXT ROUND');

        currentRoundIndex++;
        if (currentRoundIndex < activeRounds.length) {
            loadPanorama(activeRounds[currentRoundIndex].imagePath);
        }
    } catch (e) {
        if (window.DEBUG) console.error('Auto-submit failed:', e);
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
        const myRound = isChallenger ? challenge.challenger_round : challenge.challenged_round;

        if (challenge.status === 'completed' || myRound >= 6) {
            // Player already finished — restore the game-over screen
            totalScore = myScore || 0;
            showGameOver(false);
            return 'completed';
        }
    } catch (e) {
        if (window.DEBUG) console.error("Failed to check initial challenge status:", e);
    }

    document.getElementById('challenge-info').style.display = 'block';
    document.getElementById('challenge-waiting-room').style.display = 'block';
    document.getElementById('game-status-text').innerText = '';

    startChallengeTimer();
    startPolling();
}

function startChallengeTimer() {
    challengeTimerInterval = setInterval(() => {
        challengeTimeLeft--;
        if (challengeTimeLeft <= 0) {
            clearInterval(challengeTimerInterval);
            alert("Challenge expired!");
            window.location.href = '/dashboard';
        }
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
            const myRound = isChallenger ? challengeData.challenger_round : challengeData.challenged_round;
            if (challengeData.status === 'completed' || myRound >= 6) {
                clearInterval(pollInterval);
                clearInterval(challengeTimerInterval);
                totalScore = myScore || 0;
                showGameOver(false);
                return;
            }

            updateChallengeUI();

            if (challengeData.status === 'in_progress') {
                clearInterval(pollInterval);
                clearInterval(challengeTimerInterval);
                var startBtnText = document.getElementById('start-btn-text');
                var startBtn = document.getElementById('btn-start-game');
                if (startBtn) startBtn.disabled = true;
                if (startBtnText) startBtnText.innerText = 'Starting now...';
                beginGame();
            } else if (challengeData.status === 'expired') {
                clearInterval(pollInterval);
                alert("This challenge has expired.");
                window.location.href = '/dashboard';
            }
        } catch (e) {
            if (window.DEBUG) console.error("Polling failed", e);
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
        statusEl.innerText = 'Click READY when you are prepared.';
    } else if (opponentReady) {
        statusEl.innerText = 'Both players ready! Starting...';
    } else {
        statusEl.innerText = `Waiting for ${opponentName} to ready up...`;
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
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
            body: JSON.stringify({ id: challengeId })
        });
    } else {
        var startBtn = document.getElementById('btn-start-game');
        if (startBtn) startBtn.disabled = true;
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
        if (window.DEBUG) console.error("Failed to load images:", e);
        return;
    }

    currentRoundIndex = 0;
    totalScore = 0;
    activeRounds = images;

    if (challengeId) {
        var overlay = document.getElementById('game-start-overlay');
        overlay.style.display = 'flex';
        setupPhotoViewer();
        var spinner = document.getElementById('map-spinner');
        if (spinner) spinner.style.display = '';
        initMap();
        return;
    }

    document.getElementById('game-board').style.display = 'block';
    document.getElementById('game-over').style.display = 'none';

    var overlay = document.getElementById('game-start-overlay');
    overlay.classList.remove('ready');
    overlay.style.display = 'flex';

    setupPhotoViewer();

    var spinner = document.getElementById('map-spinner');
    if (spinner) spinner.style.display = '';

    initMap();
    loadPanorama(activeRounds[0].imagePath);
    loadNextRound(false);
}

function beginGame() {
    if (!activeRounds || activeRounds.length === 0) {
        return;
    }
    document.getElementById('game-start-overlay').style.display = 'none';
    if (challengeId) {
        document.getElementById('game-board').style.display = 'block';
        document.getElementById('game-over').style.display = 'none';
        loadPanorama(activeRounds[0].imagePath);
        loadNextRound(false);
    }
    startTimer();
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
    setActionState(actionBtn, 'submit', 'SUBMIT GUESS');

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
    if (isSubmitting) return;
    isSubmitting = true;

    if (!guessMarker) {
        isSubmitting = false;
        return;
    }

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
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                lat: guessLat,
                lng: guessLng,
                id: currentRoundData.id
            })
        });

        const result = await response.json();
        if (result.error) {
            if (window.DEBUG) console.error(result.error);
            actionBtn.disabled = false;
            isSubmitting = false;
            return;
        }

        const distanceMeters = result.distance;
        const roundScore = result.score;
        const actualLat = result.actual_lat;
        const actualLng = result.actual_lng;

        // Update State
        totalScore += roundScore;

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

        setActionState(actionBtn, 'next', 'NEXT ROUND');

        // Prepare for next round
        currentRoundIndex++;
        if (currentRoundIndex < activeRounds.length) {
            loadPanorama(activeRounds[currentRoundIndex].imagePath);
        }
    } catch (e) {
        if (window.DEBUG) console.error("Failed to submit guess:", e);
        actionBtn.disabled = false;
    }
    isSubmitting = false;
}

function handleAction() {
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn.getAttribute('data-action') === 'submit') {
        submitGuess();
    } else {
        loadNextRound();
    }
}

    function updateChallengeGameOverDisplay(challengeState) {
        // Ensure score box + opponent card are visible (may be hidden from solo mode)
        document.getElementById('final-score-box').style.display = '';
        document.getElementById('opponent-score-card').style.display = '';

        const finalOutcomeEl = document.getElementById('final-outcome');
        const finalStatusEl = document.getElementById('final-status');
        const playerScoreEl = document.getElementById('final-player-score');
        const opponentScoreEl = document.getElementById('final-opponent-score');
        const opponentLabelEl = document.getElementById('final-opponent-label');

        if (!challengeState) {
            if (finalOutcomeEl) finalOutcomeEl.innerText = '';
            if (finalStatusEl) {
                finalStatusEl.innerText = 'Waiting for opponent...';
                finalStatusEl.classList.add('is-waiting');
            }
            return;
        }

        const isChallenger = challengeState.challenger_id === window.current_user_id;
        const opponentName = isChallenger ? challengeState.challenged_username : challengeState.challenger_username;
        const opponentScore = isChallenger ? challengeState.challenged_score : challengeState.challenger_score;
        const opponentRound = isChallenger ? challengeState.challenged_round : challengeState.challenger_round;
        const hasResolvedResult = Boolean(challengeState.result);

        if (playerScoreEl) playerScoreEl.innerText = totalScore;
        if (opponentScoreEl) opponentScoreEl.innerText = typeof opponentScore === 'number' ? opponentScore : '—';
        if (opponentLabelEl) {
            opponentLabelEl.innerText = opponentName ? `${opponentName}` : 'Opponent';
        }

        if (finalOutcomeEl) {
            if (hasResolvedResult) {
                let outcomeText, outcomeClass;
                if (challengeState.result === 'tie') {
                    outcomeText = 'IT\'S A TIE!';
                    outcomeClass = 'outcome-tie';
                } else {
                    const amIWinner = challengeState.winner_id === window.current_user_id;
                    outcomeText = amIWinner ? 'YOU WIN!' : 'YOU LOSE!';
                    outcomeClass = amIWinner ? 'outcome-win' : 'outcome-lose';
                }
                finalOutcomeEl.className = `game-over-outcome text-uppercase font-heading ${outcomeClass}`;
                finalOutcomeEl.innerText = outcomeText;
            } else {
                finalOutcomeEl.innerText = '';
            }
        }

        if (finalStatusEl) {
            if (hasResolvedResult) {
                finalStatusEl.innerText = '';
                finalStatusEl.classList.remove('is-waiting');
            } else {
                const round = opponentRound || 0;
                if (round >= 6) {
                    finalStatusEl.innerText = 'Waiting for opponent...';
                } else if (round > 0) {
                    finalStatusEl.innerText = `Opponent on Round ${round}/5`;
                } else {
                    finalStatusEl.innerText = 'Waiting for opponent...';
                }
                finalStatusEl.classList.add('is-waiting');
            }
        }
    }

// Displays the game-over overlay with the final score.
function showGameOver(shouldSubmitCompletion = true) {
    stopTimer();

    var overlay = document.getElementById('game-start-overlay');
    if (overlay) overlay.style.display = 'none';

    var gameBoard = document.getElementById('game-board');
    if (gameBoard) {
        gameBoard.style.display = 'block';
        gameBoard.classList.add('show-results');
    }

    var gameOver = document.getElementById('game-over');
    if (gameOver) gameOver.style.display = 'flex';

    var playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
        playAgainBtn.style.display = challengeId ? 'none' : '';
    }
    
    if (challengeId) {
        // Fetch fresh data before initial display (challengeData is stale from game start)
        if (pollInterval) clearInterval(pollInterval);

        const pollNow = async () => {
            try {
                const resp = await fetch(`/api/challenges/poll/${challengeId}`);
                challengeData = await resp.json();
                updateChallengeGameOverDisplay(challengeData);

                if (challengeData.result) {
                    clearInterval(pollInterval);
                }
            } catch (e) {
                if (window.DEBUG) console.error("GameOver polling failed", e);
            }
        };

        pollNow();
        pollInterval = setInterval(pollNow, 3000);
    } else {
        // Solo mode: centred score, no labels — the score IS the title
        document.getElementById('final-score-box').style.display = 'none';
        document.getElementById('final-outcome').className = 'game-over-outcome text-uppercase font-heading outcome-final';
        document.getElementById('final-outcome').innerText = totalScore;
        document.getElementById('final-status').innerText = 'FINAL SCORE';
    }
    
    if (shouldSubmitCompletion) {
        sendGameComplete(totalScore);
    }
}

function sendGameComplete(finalScore) {
    if (gameCompleteSent) return;
    gameCompleteSent = true;

    const body = { totalScore: finalScore };
    if (challengeId) body.challengeId = challengeId;

    fetch('/api/game-complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
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
            if (window.DEBUG) console.warn('Score save failed:', e.message || e);
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
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
            body: JSON.stringify({ id: challengeId, round: roundNum, score: score })
        });
    } catch (e) {
        if (window.DEBUG) console.error("Progress update failed", e);
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
window.addEventListener('load', startGame);

window.addEventListener('beforeunload', function () {
    if (pollInterval) clearInterval(pollInterval);
    if (challengeTimerInterval) clearInterval(challengeTimerInterval);
});