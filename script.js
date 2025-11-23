// --- DRY FIRE REFERENCES (EXISTING) ---
const dryFireTab = document.getElementById('dryFireTab');
const mmaTab = document.getElementById('mmaTab');
const dryFireContent = document.getElementById('dryFireContent');
const mmaContent = document.getElementById('mmaContent');
const modeSelector = document.getElementById('modeSelector'); 
const minDelayInput = document.getElementById('minDelay');
const maxDelayInput = document.getElementById('maxDelay');
const parTimeInput = document.getElementById('parTime');
const repetitionsInput = document.getElementById('repetitions');
const restTimeInput = document.getElementById('restTime');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDisplay = document.getElementById('status');
const counterDisplay = document.getElementById('counter');
const currentSetDisplay = document.getElementById('currentSet');
const logTableBody = document.querySelector('#logTable tbody'); 
const minDelayLabel = document.getElementById('minDelayLabel');
const maxDelayGroup = document.getElementById('maxDelayGroup');
const container = document.querySelector('.container');
const displayArea = document.querySelector('.display-area');
const logPanel = document.getElementById('logPanel');
const headerMotto = document.getElementById('header-motto');

// --- MMA TIMER REFERENCES (NEW) ---
const mmaModeSelector = document.getElementById('mmaModeSelector');
const mmaRoundTimeInput = document.getElementById('mmaRoundTime');
const mmaRestTimeInput = document.getElementById('mmaRestTime');
const mmaRoundsInput = document.getElementById('mmaRounds');
const mmaStartButton = document.getElementById('mmaStartButton');
const mmaStopButton = document.getElementById('mmaStopButton');
const mmaCounterDisplay = document.getElementById('mmaCounter');
const mmaStatusDisplay = document.getElementById('mmaStatus');
const mmaCurrentRoundDisplay = document.getElementById('mmaCurrentRound');
const mmaLogTableBody = document.querySelector('#mmaLogTable tbody');
const mmaRandomRangeGroup = document.getElementById('mmaRandomRange');
const mmaMinRoundInput = document.getElementById('mmaMinRound');
const mmaMaxRoundInput = document.getElementById('mmaMaxRound');

// --- GLOBAL VARIABLES ---
let audioContext = null; 
let mainTimerId = null; 
let mmaTimerId = null; 
let animationFrameId = null;
let startTime = 0;
let isRunningDryFire = false; 
let isRunningMMA = false; 

// --- DRY FIRE STATE ---
let currentRepetition = 0;
let totalRepetitions = 0;
let isCountingTime = false;
// mejor comprobación defensiva
let speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.speechSynthesis.speak === 'function';

// --- MMA TIMER STATE ---
let currentRound = 0;
let totalRounds = 0;
let isRoundTime = false;
let currentRoundDuration = 0;
let currentRestDuration = 0; 


// ----------------------------------------------------
// --- AUDIO CONTEXT FUNCTIONS ---
// ----------------------------------------------------

function initAudioContext() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            return audioContext.resume().catch(e => {
                console.error("Error al reanudar AudioContext:", e);
            });
        }
    } catch (e) {
        console.warn("initAudioContext fallo:", e);
        audioContext = null;
    }
    return Promise.resolve();
}

async function playBeep(frequency, duration) {
    try {
        await initAudioContext();
        if (!audioContext) return;

        const context = audioContext;
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);

        gainNode.gain.setValueAtTime(0.0001, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.5, context.currentTime + 0.01);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + duration / 1000);

        gainNode.gain.exponentialRampToValueAtTime(
            0.0001, 
            context.currentTime + duration / 1000 - 0.01
        );

        setTimeout(() => {
            try { oscillator.disconnect(); gainNode.disconnect(); } catch {}
        }, duration + 50);

    } catch (e) {
        console.error("playBeep error:", e);
    }
}


// ----------------------------------------------------
// ✅ DESBLOQUEO DE VOZ – PARCHE ANDROID + iOS (MEJORADO)
// ----------------------------------------------------
// Nota: nunca debe colgarse; incluye failsafe interno y onerror.
// Devuelve Promise que se resuelve siempre.
function unlockTTS(timeoutMs = 1200) {
    return new Promise(resolve => {
        if (!speechAvailable) return resolve();
        try {
            const u = new SpeechSynthesisUtterance("listo");
            u.lang = "es-ES";
            u.volume = 0.01;  // volumen mínimo (Android no acepta 0)
            u.rate = 1;
            u.pitch = 1;

            let resolved = false;
            const finish = () => { if (!resolved) { resolved = true; resolve(); }};

            u.onend = finish;
            u.onerror = finish;

            // Intenta hablar (debe estar dentro de gesture -> click)
            try {
                window.speechSynthesis.speak(u);
            } catch (e) {
                // si falla speak por cualquier motivo no bloquear
                finish();
            }

            // failsafe: si no hay evento onend/onerror resolver de todos modos
            setTimeout(finish, timeoutMs);

        } catch (e) {
            resolve();
        }
    });
}


// ----------------------------------------------------
// --- DRY FIRE SOUNDS & VOICE ---
// ----------------------------------------------------

function startBeep() {
    // fire-and-forget
    playBeep(2000, 200);
    statusDisplay.textContent = `¡FUEGO! COMPLETAR EJERCICIO`;
    startTimerDisplay();
}

function parTimeBeep() {
    stopTimerDisplay();
    playBeep(400, 150);
    setTimeout(() => playBeep(400, 150), 200);

    statusDisplay.textContent = `TIEMPO LÍMITE ALCANZADO.`;
}

function readyVoice() {
    if (!speechAvailable) {
        statusDisplay.textContent = `PREPARADO... ESPERANDO SEÑAL`;
        return;
    }

    try {
        // cancelar voces previas
        window.speechSynthesis.cancel();

        // --- CORRECCIÓN APLICADA AQUÍ ---
        setTimeout(() => {
            try {
                const u = new SpeechSynthesisUtterance("Preparado?");
                u.lang = "es-ES";
                u.volume = 1;
                u.rate = 1;
                u.pitch = 1;

                // failsafe para Android
                u.onerror = () => console.log("TTS error");

                speechSynthesis.speak(u);
            } catch (e) {
                console.log("Error al reproducir 'Preparado?':", e);
            }
        }, 400);  // este retraso es la clave
        // --------------------------------

    } catch (e) {
        statusDisplay.textContent = `PREPARADO... ESPERANDO SEÑAL`;
    }
}


// ----------------------------------------------------
// --- HIGH PRECISION TIMER ---
// ----------------------------------------------------

function startTimerDisplay() {
    startTime = Date.now();
    isCountingTime = true;
    updateTimerDisplay();
}

function stopTimerDisplay() {
    isCountingTime = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function updateTimerDisplay() {
    if (!isCountingTime) return;

    const elapsedTime = Date.now() - startTime;
    const seconds = Math.floor(elapsedTime / 1000);
    const centiseconds = Math.floor((elapsedTime % 1000) / 10);

    counterDisplay.textContent =
        `${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;

    animationFrameId = requestAnimationFrame(updateTimerDisplay);
}


// ----------------------------------------------------
// --- DRY FIRE LOGIC ---
// ----------------------------------------------------

// acepta strings o números; devuelve ms
function getRandomDelay(min, max) {
    const minNum = parseFloat(min);
    const maxNum = parseFloat(max);
    const minMs = minNum * 1000;
    const maxMs = maxNum * 1000;

    if (Number.isNaN(minMs) || Number.isNaN(maxMs)) return 1000; // fallback 1s

    if (minMs === maxMs) return minMs;

    return Math.random() * (maxMs - minMs) + minMs;
}

function runRepetition() {
    if (!isRunningDryFire) return;

    try {
        const currentMode = modeSelector.value;

        if (currentRepetition >= totalRepetitions) {
            stopDryFire(true);
            return;
        }

        let minDelay = parseFloat(minDelayInput.value);
        let maxDelay = parseFloat(maxDelayInput.value);
        let parTime = parseFloat(parTimeInput.value);

        if (Number.isNaN(minDelay)) minDelay = 1.0;
        if (Number.isNaN(maxDelay)) maxDelay = minDelay;
        if (Number.isNaN(parTime)) parTime = 1.5;

        if (currentMode === 'manual') {
            maxDelay = minDelay;
            maxDelayInput.value = minDelay;
        }

        if (currentMode === 'pro') {
            const rangeMin = 1.0;
            const rangeMax = 6.0;

            const newMin = Math.random() * (rangeMax - rangeMin) + rangeMin;
            const newMax = newMin + (Math.random() * (rangeMax - newMin - 0.5)) + 0.5;

            minDelay = parseFloat(newMin.toFixed(1));
            maxDelay = parseFloat(newMax.toFixed(1));

            minDelayInput.value = minDelay;
            maxDelayInput.value = maxDelay;
        }

        if (minDelay > maxDelay) {
            statusDisplay.textContent = "ERROR: Retardo Min. debe ser menor o igual que el Máx.";
            stopDryFire(false);
            return;
        }

        const parTimeMs = parTime * 1000;
        currentRepetition++;

        createDryFireLogEntry(currentRepetition, minDelay, maxDelay, parTime);
        currentSetDisplay.textContent = `Set: ${currentRepetition}/${totalRepetitions}`;

        // voz de preparación (no bloqueante)
        readyVoice();

        const delayToUse = getRandomDelay(minDelay, maxDelay);
        counterDisplay.textContent = '00.00';

        statusDisplay.textContent = speechAvailable
            ? `ESPERANDO SEÑAL...`
            : `PREPARACIÓN... ESPERANDO SEÑAL`;

        mainTimerId = setTimeout(() => {
            if (!isRunningDryFire) return;
            startBeep();

            mainTimerId = setTimeout(() => {
                if (!isRunningDryFire) return;

                parTimeBeep();

                if (currentRepetition < totalRepetitions) {
                    const restMs = parseFloat(restTimeInput.value) * 1000 || 3000;
                    statusDisplay.textContent =
                        `¡HECHO! DESCANSO. PRÓXIMO SET EN ${restMs / 1000}s...`;

                    mainTimerId = setTimeout(runRepetition, restMs);
                } else {
                    stopDryFire(true);
                }

            }, parTimeMs);

        }, delayToUse);

    } catch (e) {
        console.error("runRepetition fallo:", e);
        stopDryFire(false);
    }
}

function startDryFire() {
    try {
        if (isRunningDryFire) return;

        totalRepetitions = parseInt(repetitionsInput.value);
        if (totalRepetitions < 1 || isNaN(totalRepetitions)) {
            alert("El número de Repeticiones debe ser 1 o más.");
            return;
        }

        if (modeSelector.value === 'manual') {
            maxDelayInput.value = minDelayInput.value;
        }

        currentRepetition = 0;
        isRunningDryFire = true;

        toggleDryFireControls(true);
        clearDryFireLog();
        runRepetition();
    } catch (e) {
        console.error("startDryFire fallo:", e);
        isRunningDryFire = false;
        toggleDryFireControls(false);
    }
}

function stopDryFire(completed = false) {
    try {
        clearTimeout(mainTimerId);
        stopTimerDisplay();
        isRunningDryFire = false;

        if (speechAvailable) {
            try { window.speechSynthesis.cancel(); } catch(e){}
        }

        toggleDryFireControls(false);

        if (completed) {
            statusDisplay.textContent = 'ENTRENAMIENTO COMPLETADO';
            counterDisplay.textContent = 'FIN';
        } else {
            const setsDone = currentRepetition > 0 ? currentRepetition - 1 : 0;
            statusDisplay.textContent = `DETENIDO. ${setsDone} SETS REALIZADOS`;
            counterDisplay.textContent = 'PAUSA';
        }
        currentSetDisplay.textContent = 'Set: 0/0';
    } catch (e) {
        console.error("stopDryFire fallo:", e);
    }
}

function clearDryFireLog() {
    if (logTableBody) logTableBody.innerHTML = '';
}

function createDryFireLogEntry(setNumber, minDelay, maxDelay, parTime) {
    if (!logTableBody) return null;
    const row = logTableBody.insertRow();
    row.id = `set-${setNumber}`;

    row.insertCell().textContent = setNumber;
    row.insertCell().textContent = `${minDelay.toFixed(1)} - ${maxDelay.toFixed(1)} s`;
    row.insertCell().textContent = parTime.toFixed(2) + ' s';
    row.insertCell().textContent = parTime.toFixed(2) + ' s';

    return row;
}

function toggleDryFireControls(disable) {
    startButton.disabled = disable;
    stopButton.disabled = !disable;
    parTimeInput.disabled = disable;
    repetitionsInput.disabled = disable;
    restTimeInput.disabled = disable;
    modeSelector.disabled = disable;

    if (modeSelector.value === 'pro') {
        minDelayInput.disabled = true;
        maxDelayInput.disabled = true;
    } else if (modeSelector.value === 'manual') {
        minDelayInput.disabled = disable;
    }
}

function updateDryFireInterfaceByMode() {
    const mode = modeSelector.value;

    if (mode === 'pro') {
        minDelayLabel.textContent = 'RETARDO MIN. (s)';
        if (maxDelayGroup) maxDelayGroup.style.display = 'flex';
        minDelayInput.disabled = true;
        maxDelayInput.disabled = true;

    } else if (mode === 'manual') {
        minDelayLabel.textContent = 'RETARDO (s)';
        if (maxDelayGroup) maxDelayGroup.style.display = 'none';
        minDelayInput.disabled = false;
    }

    startButton.textContent = 'INICIAR';
    statusDisplay.textContent = 'CONFIGURA Y PULSA INICIAR';
    counterDisplay.textContent = '00.00';
    currentSetDisplay.textContent = 'Set: 0/0';
}


// ----------------------------------------------------
// --- MMA TIMER LOGIC ---
// ----------------------------------------------------

function updateMMAInterfaceByMode() {
    const mode = mmaModeSelector.value;
    const isRandom = mode === 'random';

    if (mmaRoundTimeInput) mmaRoundTimeInput.classList.toggle('hidden', isRandom);
    if (mmaRoundTimeInput) mmaRoundTimeInput.disabled = isRandom;

    if (mmaRandomRangeGroup) mmaRandomRangeGroup.classList.toggle('hidden', !isRandom);
    if (mmaMinRoundInput) mmaMinRoundInput.disabled = !isRandom;
    if (mmaMaxRoundInput) mmaMaxRoundInput.disabled = !isRandom;
}

function getRoundDuration() {
    if (mmaModeSelector.value === 'random') {
        const min = parseInt(mmaMinRoundInput.value) * 60;
        const max = parseInt(mmaMaxRoundInput.value) * 60;
        
        const effectiveMin = Math.max(min, 180);
        const randomMinutes =
            Math.floor(Math.random() * ((max / 60) - (effectiveMin / 60) + 1)) +
            (effectiveMin / 60);

        return randomMinutes * 60;
    }

    return parseInt(mmaRoundTimeInput.value) * 60;
}

function startMMA() {
    if (isRunningMMA) return;

    initAudioContext();
    stopDryFire(false);

    totalRounds = parseInt(mmaRoundsInput.value);
    currentRestDuration = parseInt(mmaRestTimeInput.value);

    if (totalRounds < 1 || isNaN(totalRounds)) {
        alert("El número de Asaltos debe ser 1 o más.");
        return;
    }

    currentRound = 0;
    isRunningMMA = true;

    mmaLogTableBody.innerHTML = '';
    mmaCounterDisplay.textContent = "00:00";
    mmaStatusDisplay.textContent = "¡PREPÁRATE!";

    mmaToggleControls(true);

    mmaCurrentRoundDisplay.textContent =
        `ASALTO: 0/${totalRounds} - ESTADO: PREPARACIÓN`;

    mmaTimerId = setTimeout(runMMASequence, 3000);
}

function stopMMA() {
    try {
        clearTimeout(mmaTimerId);
        clearInterval(mmaTimerId);
        isRunningMMA = false;

        if (speechAvailable) window.speechSynthesis.cancel();

        mmaToggleControls(false);
        mmaStatusDisplay.textContent =
            `DETENIDO. ${currentRound}/${totalRounds} ASALTOS REALIZADOS`;

        mmaCurrentRoundDisplay.textContent = 'ASALTO: 0/0 - ESTADO: PAUSA';
        mmaCounterDisplay.textContent = '00:00';
    } catch (e) {
        console.error("stopMMA fallo:", e);
    }
}

function mmaToggleControls(disable) {
    mmaStartButton.disabled = disable;
    mmaStopButton.disabled = !disable;
    mmaRoundsInput.disabled = disable;
    mmaRestTimeInput.disabled = disable;
    mmaModeSelector.disabled = disable;

    mmaRoundTimeInput.disabled =
        mmaModeSelector.value === 'fixed' ? disable : true;

    mmaMinRoundInput.disabled =
        mmaModeSelector.value === 'random' ? disable : true;

    mmaMaxRoundInput.disabled =
        mmaModeSelector.value === 'random' ? disable : true;
}

function runMMASequence() {
    if (!isRunningMMA) return;

    if (currentRound >= totalRounds) {
        mmaStatusDisplay.textContent = '¡ENTRENAMIENTO COMPLETADO!';
        mmaCurrentRoundDisplay.textContent = 'ASALTO: COMPLETO';

        playBeep(400, 500);
        setTimeout(() => playBeep(400, 500), 600);
        setTimeout(() => playBeep(400, 500), 1200);

        stopMMA();
        return;
    }

    currentRound++;
    isRoundTime = true;
    currentRoundDuration = getRoundDuration();

    mmaLogEntry('ASALTO', currentRound, currentRoundDuration / 60, currentRestDuration);

    mmaStatusDisplay.textContent = '¡ASALTO!';
    mmaCurrentRoundDisplay.textContent =
        `ASALTO: ${currentRound}/${totalRounds} - ESTADO: ASALTO`;

    playBeep(800, 500);

    startMMACounter(currentRoundDuration, startRest);
}

function startRest() {
    if (!isRunningMMA) return;

    isRoundTime = false;

    if (currentRound < totalRounds) {
        mmaStatusDisplay.textContent = '¡TIEMPO! DESCANSO.';
        mmaCurrentRoundDisplay.textContent =
            `ASALTO: ${currentRound}/${totalRounds} - ESTADO: DESCANSO`;

        playBeep(400, 500);

        mmaLogEntry('DESCANSO', currentRound, currentRoundDuration / 60, currentRestDuration);

        startMMACounter(currentRestDuration, runMMASequence);

    } else {
        runMMASequence();
    }
}

async function startMMACounter(duration, callback) {
    await initAudioContext().catch(() => {});

    let timeLeft = duration;
    clearInterval(mmaTimerId);

    function updateCounter() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        mmaCounterDisplay.textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (timeLeft === 10 && speechAvailable) {
            try {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance("Diez segundos"));
            } catch (e) {}
        }

        if (timeLeft <= 3 && timeLeft > 0) {
            playBeep(isRoundTime ? 1000 : 600, 100);
        }

        if (timeLeft <= 0) {
            clearInterval(mmaTimerId);
            callback();
        } else {
            timeLeft--;
        }
    }

    updateCounter();
    mmaTimerId = setInterval(updateCounter, 1000);
}

function mmaLogEntry(type, roundNum, roundTimeMin, restTimeSec) {
    const row = mmaLogTableBody.insertRow();

    row.insertCell().textContent = roundNum;
    row.insertCell().textContent = `${roundTimeMin.toFixed(1)} min`;
    row.insertCell().textContent = `${restTimeSec} s`;

    const typeCell = row.insertCell();
    typeCell.textContent = type;
    typeCell.style.fontWeight = 'bold';
    typeCell.style.color = type === 'ASALTO' ? '#00e676' : '#ff3d00';
}


// ----------------------------------------------------
// --- UI & EVENTS ---
// ----------------------------------------------------

function setDryFireStyle() {
    const green = '#00e676';
    const greenShadow = '0 0 5px rgba(0, 230, 118, 0.7)';
    
    if (container) container.style.borderColor = green;
    if (displayArea) displayArea.style.borderColor = green;
    if (headerMotto) headerMotto.style.color = green;
    if (headerMotto) headerMotto.style.borderBottomColor = green;
    
    const h1 = document.querySelector('h1');
    if (h1) { h1.style.color = green; h1.style.textShadow = greenShadow; }
    const c = document.getElementById('counter');
    if (c) c.style.color = green;

    const sb = document.getElementById('startButton');
    const st = document.getElementById('stopButton');
    if (sb) sb.style.backgroundColor = green;
    if (st) st.style.backgroundColor = '#ff3d00';
}

function setMMAStyle() {
    const red = '#ff3d00';
    const redShadow = '0 0 5px rgba(255, 61, 0, 0.7)';

    if (container) container.style.borderColor = red;
    if (displayArea) displayArea.style.borderColor = red;
    if (headerMotto) headerMotto.style.color = red;
    if (headerMotto) headerMotto.style.borderBottomColor = red;
    
    const h1 = document.querySelector('h1');
    if (h1) { h1.style.color = red; h1.style.textShadow = redShadow; }
    const mc = document.getElementById('mmaCounter');
    if (mc) mc.style.color = red;

    const msb = document.getElementById('mmaStartButton');
    const msstop = document.getElementById('mmaStopButton');
    if (msb) msb.style.backgroundColor = red;
    if (msstop) msstop.style.backgroundColor = '#00e676';
}

dryFireTab.addEventListener('click', () => {
    if (dryFireContent) dryFireContent.classList.remove('hidden');
    if (mmaContent) mmaContent.classList.add('hidden');
    dryFireTab.classList.add('active');
    mmaTab.classList.remove('active');
    
    stopMMA();
    setDryFireStyle();
    updateDryFireInterfaceByMode();
});

mmaTab.addEventListener('click', () => {
    if (mmaContent) mmaContent.classList.remove('hidden');
    if (dryFireContent) dryFireContent.classList.add('hidden');
    mmaTab.classList.add('active');
    dryFireTab.classList.remove('active');
    
    stopDryFire(false);
    setMMAStyle();
    updateMMAInterfaceByMode();
});


// ----------------------------------------------------
// ✅ BOTÓN INICIAR – SECUENCIA SEGURA UNIVERSAL (CON TIMEOUT)
// ----------------------------------------------------
// Mejora: si unlockTTS se comporta raro, no bloquea el inicio nunca.

startButton.addEventListener('click', async () => {
    // Protección: si el botón está deshabilitado, no hacemos nada
    if (startButton.disabled) return;

    // Desactivar momentáneamente para evitar doble-click
    startButton.disabled = true;

    try {
        // 1) Intentar inicializar AudioContext (no fatal)
        await initAudioContext().catch(() => {});

        // 2) Intentar forzar carga de voces (algunos motores lo requieren)
        try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (e) {}

        // 3) Intentar desbloquear TTS pero con timeout corto (failsafe)
        if (speechAvailable) {
            // Promise.race por seguridad: si tarda >1200ms sigue adelante
            await Promise.race([
                unlockTTS(1000),
                new Promise(res => setTimeout(res, 1100))
            ]);
        }

    } catch (e) {
        console.warn("startButton sequence fallo (seguimos adelante):", e);
    } finally {
        // Siempre arrancar el dry fire aunque TTS/audio fallen
        try {
            startDryFire();
        } catch (e) {
            console.error("startDryFire lanzamiento fallo:", e);
            // restaurar estado UI
            toggleDryFireControls(false);
        } finally {
            // permitir botón si no está corriendo (startDryFire lo desactivará si procede)
            if (!isRunningDryFire) startButton.disabled = false;
        }
    }
});


stopButton.addEventListener('click', () => stopDryFire(false));
modeSelector.addEventListener('change', updateDryFireInterfaceByMode);

mmaStartButton.addEventListener('click', startMMA);
mmaStopButton.addEventListener('click', stopMMA);
mmaModeSelector.addEventListener('change', updateMMAInterfaceByMode);

document.addEventListener('DOMContentLoaded', () => {
    try {
        updateDryFireInterfaceByMode();
        updateMMAInterfaceByMode();
        setDryFireStyle();
    } catch (e) { console.error(e); }
    
    if (minDelayInput) {
        minDelayInput.addEventListener('change', () => {
            if (modeSelector.value === 'manual') {
                maxDelayInput.value = minDelayInput.value;
            }
        });
    }
});
