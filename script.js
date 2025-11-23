// --- DRY FIRE REFERENCES ---
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
const headerMotto = document.getElementById('header-motto');

// --- MMA TIMER REFERENCES ---
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

// --- MMA TIMER STATE ---
let currentRound = 0;
let totalRounds = 0;
let isRoundTime = false;
let currentRoundDuration = 0;
let currentRestDuration = 0; 


// ----------------------------------------------------
// --- AUDIO CONTEXT FUNCTIONS (MEJORADO) ---
// ----------------------------------------------------

function initAudioContext() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            return audioContext.resume().catch(e => console.error(e));
        }
    } catch (e) {
        audioContext = null;
    }
    return Promise.resolve();
}

// Función básica para pitidos normales (Ready, Par Time, MMA)
async function playBeep(frequency, duration, type = 'square', volume = 1.0) {
    try {
        await initAudioContext();
        if (!audioContext) return;

        const context = audioContext;
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);

        // Ataque instantáneo para que suene más golpeado
        gainNode.gain.setValueAtTime(volume, context.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + duration / 1000);

        // Pequeño fade out muy rápido al final para evitar "pop"
        gainNode.gain.setValueAtTime(volume, context.currentTime + duration / 1000 - 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration / 1000);

        setTimeout(() => {
            try { oscillator.disconnect(); gainNode.disconnect(); } catch {}
        }, duration + 50);

    } catch (e) {
        console.error("playBeep error:", e);
    }
}

// NUEVA FUNCIÓN ESPECIAL PARA EL SONIDO DE "FUEGO" POTENTE
// Combina dos osciladores para crear un efecto de disonancia estilo "Shot Timer" profesional
async function playPowerFireSignal() {
    try {
        await initAudioContext();
        if (!audioContext) return;
        const ctx = audioContext;
        const t = ctx.currentTime;
        const duration = 0.35; // 350ms de duración (un poco más largo)

        // Oscilador 1: Frecuencia Principal (Aguda y penetrante)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth'; // Dientes de sierra corta más que la cuadrada
        osc1.frequency.setValueAtTime(2000, t); 
        
        // Oscilador 2: Frecuencia Desafinada (Crea el efecto de potencia/vibración)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square'; 
        osc2.frequency.setValueAtTime(2025, t); // 25Hz de diferencia crea la "rugosidad"

        // Configuración de volumen al MÁXIMO
        gain1.gain.setValueAtTime(0.6, t); // Sumados dan > 1.0, pero el limitador del navegador lo maneja
        gain2.gain.setValueAtTime(0.6, t);

        osc1.connect(gain1);
        osc2.connect(gain2);
        gain1.connect(ctx.destination);
        gain2.connect(ctx.destination);

        osc1.start(t);
        osc2.start(t);
        
        osc1.stop(t + duration);
        osc2.stop(t + duration);

        // Limpieza
        setTimeout(() => {
            try { 
                osc1.disconnect(); gain1.disconnect(); 
                osc2.disconnect(); gain2.disconnect();
            } catch {}
        }, (duration * 1000) + 100);

    } catch (e) {
        console.error("PowerBeep error", e);
    }
}


// ----------------------------------------------------
// --- SONIDOS ---
// ----------------------------------------------------

function readySignal() {
    // Señal de "Preparado": Dos pitidos graves
    playBeep(600, 100, 'square', 0.8);
    setTimeout(() => playBeep(600, 100, 'square', 0.8), 150);
    
    statusDisplay.textContent = `PREPARADO... ESPERANDO SEÑAL`;
}

function startBeep() {
    // Señal de "FUEGO": NUEVA VERSIÓN POTENTE
    playPowerFireSignal();
    statusDisplay.textContent = `¡FUEGO! COMPLETAR EJERCICIO`;
    startTimerDisplay();
}

function parTimeBeep() {
    // Señal de Tiempo Límite: Dos pitidos muy graves
    stopTimerDisplay();
    playBeep(350, 200, 'sine', 1.0);
    setTimeout(() => playBeep(350, 200, 'sine', 1.0), 250);

    statusDisplay.textContent = `TIEMPO LÍMITE ALCANZADO.`;
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
    counterDisplay.textContent = `${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    animationFrameId = requestAnimationFrame(updateTimerDisplay);
}


// ----------------------------------------------------
// --- DRY FIRE LOGIC ---
// ----------------------------------------------------

function getRandomDelay(min, max) {
    const minNum = parseFloat(min);
    const maxNum = parseFloat(max);
    const minMs = minNum * 1000;
    const maxMs = maxNum * 1000;
    if (Number.isNaN(minMs) || Number.isNaN(maxMs)) return 1000; 
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

        // 1. Sonido de "Preparado"
        readySignal();

        const delayToUse = getRandomDelay(minDelay, maxDelay);
        counterDisplay.textContent = '00.00';

        // Timer principal para el "FUEGO"
        mainTimerId = setTimeout(() => {
            if (!isRunningDryFire) return;
            
            // 2. Sonido de Fuego POTENTE
            startBeep();

            // Timer para el tiempo límite (PAR Time)
            mainTimerId = setTimeout(() => {
                if (!isRunningDryFire) return;

                parTimeBeep();

                // Lógica de descanso o fin
                if (currentRepetition < totalRepetitions) {
                    const restMs = parseFloat(restTimeInput.value) * 1000 || 3000;
                    statusDisplay.textContent = `¡HECHO! DESCANSO. PRÓXIMO SET EN ${restMs / 1000}s...`;
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
    if (mmaRoundTimeInput) {
        mmaRoundTimeInput.classList.toggle('hidden', isRandom);
        mmaRoundTimeInput.disabled = isRandom;
    }
    if (mmaRandomRangeGroup) mmaRandomRangeGroup.classList.toggle('hidden', !isRandom);
    if (mmaMinRoundInput) mmaMinRoundInput.disabled = !isRandom;
    if (mmaMaxRoundInput) mmaMaxRoundInput.disabled = !isRandom;
}

function getRoundDuration() {
    if (mmaModeSelector.value === 'random') {
        const min = parseInt(mmaMinRoundInput.value) * 60;
        const max = parseInt(mmaMaxRoundInput.value) * 60;
        const effectiveMin = Math.max(min, 180);
        const randomMinutes = Math.floor(Math.random() * ((max / 60) - (effectiveMin / 60) + 1)) + (effectiveMin / 60);
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
    mmaCurrentRoundDisplay.textContent = `ASALTO: 0/${totalRounds} - ESTADO: PREPARACIÓN`;
    mmaTimerId = setTimeout(runMMASequence, 3000);
}

function stopMMA() {
    clearTimeout(mmaTimerId);
    clearInterval(mmaTimerId);
    isRunningMMA = false;
    mmaToggleControls(false);
    mmaStatusDisplay.textContent = `DETENIDO. ${currentRound}/${totalRounds} ASALTOS REALIZADOS`;
    mmaCurrentRoundDisplay.textContent = 'ASALTO: 0/0 - ESTADO: PAUSA';
    mmaCounterDisplay.textContent = '00:00';
}

function mmaToggleControls(disable) {
    mmaStartButton.disabled = disable;
    mmaStopButton.disabled = !disable;
    mmaRoundsInput.disabled = disable;
    mmaRestTimeInput.disabled = disable;
    mmaModeSelector.disabled = disable;
    mmaRoundTimeInput.disabled = mmaModeSelector.value === 'fixed' ? disable : true;
    mmaMinRoundInput.disabled = mmaModeSelector.value === 'random' ? disable : true;
    mmaMaxRoundInput.disabled = mmaModeSelector.value === 'random' ? disable : true;
}

function runMMASequence() {
    if (!isRunningMMA) return;
    if (currentRound >= totalRounds) {
        mmaStatusDisplay.textContent = '¡ENTRENAMIENTO COMPLETADO!';
        mmaCurrentRoundDisplay.textContent = 'ASALTO: COMPLETO';
        playBeep(400, 500, 'square', 1.0);
        setTimeout(() => playBeep(400, 500, 'square', 1.0), 600);
        setTimeout(() => playBeep(400, 500, 'square', 1.0), 1200);
        stopMMA();
        return;
    }
    currentRound++;
    isRoundTime = true;
    currentRoundDuration = getRoundDuration();
    mmaLogEntry('ASALTO', currentRound, currentRoundDuration / 60, currentRestDuration);
    mmaStatusDisplay.textContent = '¡ASALTO!';
    mmaCurrentRoundDisplay.textContent = `ASALTO: ${currentRound}/${totalRounds} - ESTADO: ASALTO`;
    
    // Sonido de Inicio de Ronda (Gong/Largo)
    playBeep(800, 700, 'sawtooth', 1.0);
    startMMACounter(currentRoundDuration, startRest);
}

function startRest() {
    if (!isRunningMMA) return;
    isRoundTime = false;
    if (currentRound < totalRounds) {
        mmaStatusDisplay.textContent = '¡TIEMPO! DESCANSO.';
        mmaCurrentRoundDisplay.textContent = `ASALTO: ${currentRound}/${totalRounds} - ESTADO: DESCANSO`;
        playBeep(400, 500, 'square', 1.0);
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
        mmaCounterDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (timeLeft <= 3 && timeLeft > 0) {
            playBeep(isRoundTime ? 1000 : 600, 100, 'square', 0.8);
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

// EVENTO SIMPLE - CLICK DIRECTO
startButton.addEventListener('click', async () => {
    if (startButton.disabled) return;
    await initAudioContext();
    startDryFire();
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
            if (modeSelector.value === 'manual') maxDelayInput.value = minDelayInput.value;
        });
    }
});
