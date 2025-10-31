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
const headerMotto = document.getElementById('header-motto'); // Referencia para el borde y color

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
let speechAvailable = 'speechSynthesis' in window; 
let speechInitialized = false; // Para rastrear si SpeechSynthesis ha sido activado

// --- MMA TIMER STATE ---
let currentRound = 0;
let totalRounds = 0;
let isRoundTime = false;
let currentRoundDuration = 0;
let currentRestDuration = 0; 


// ----------------------------------------------------
// --- FUNCIONES DE AUDIO GARANTIZADAS ---
// ----------------------------------------------------

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        return audioContext.resume().catch(e => console.error("Error al reanudar AudioContext:", e));
    }
    return Promise.resolve();
}

function playBeep(frequency, duration) {
    if (!audioContext) {
        console.warn("AudioContext no inicializado.");
        return;
    }
    
    const context = audioContext;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    
    gainNode.gain.setValueAtTime(0.5, context.currentTime); 
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration / 1000);
}

// 1. Pitido de INICIO (2000 Hz, 200 ms) - DRY FIRE
function startBeep() {
    playBeep(2000, 200); 
    statusDisplay.textContent = `¡FUEGO! COMPLETAR EJERCICIO`;
    startTimerDisplay();
}

// 2. Pitido de TIEMPO LÍMITE (Doble, bajo) - DRY FIRE
function parTimeBeep() {
    stopTimerDisplay(); 
    playBeep(400, 150);
    setTimeout(() => playBeep(400, 150), 200);

    statusDisplay.textContent = `TIEMPO LÍMITE ALCANZADO.`;
}

// 3. Voz PREPARADO? - DRY FIRE (CORREGIDO)
function readyVoice() {
    if (speechAvailable) {
        window.speechSynthesis.cancel(); 
        
        const utterance = new SpeechSynthesisUtterance("PREPARADO?"); 
        utterance.lang = 'es-ES'; 
        utterance.rate = 1.0; 
        
        // Obtener la voz es asíncrono y puede que el array de voces esté vacío al principio
        // Por eso la inicialización la hacemos en el click para "despertar" la API.
        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));

        if (spanishVoice) {
            utterance.voice = spanishVoice;
        } 
        
        window.speechSynthesis.speak(utterance);
    } else {
        statusDisplay.textContent = `PREPARADO... ESPERANDO SEÑAL`;
    }
}

// ----------------------------------------------------
// --- CRONÓMETRO DE ALTA PRECISIÓN (DRY FIRE) ---
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

    const formattedTime = `${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    counterDisplay.textContent = formattedTime;

    animationFrameId = requestAnimationFrame(updateTimerDisplay);
}


// ----------------------------------------------------
// --- LÓGICA DRY FIRE TIMER (FLUJO CONTINUO) ---
// ----------------------------------------------------

function getRandomDelay(min, max) {
    const minMs = parseFloat(min) * 1000;
    const maxMs = parseFloat(max) * 1000;
    const delay = Math.random() * (maxMs - minMs) + minMs;
    
    if (minMs === maxMs) {
        return minMs;
    }
    return delay;
}

function runRepetition() {
    if (!isRunningDryFire) return;

    const currentMode = modeSelector.value;
    
    if (currentRepetition >= totalRepetitions) {
        stopDryFire(true);
        return;
    }

    let minDelay = parseFloat(minDelayInput.value);
    let maxDelay = parseFloat(maxDelayInput.value);
    let parTime = parseFloat(parTimeInput.value);
    
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

    const parTimeMs = parTime * 1000;
    
    if (minDelay > maxDelay) { 
        statusDisplay.textContent = "ERROR: Retardo Min. debe ser menor o igual que el Máx.";
        stopDryFire(false);
        return;
    }

    currentRepetition++;

    createDryFireLogEntry(currentRepetition, minDelay, maxDelay, parTime); 
    currentSetDisplay.textContent = `Set: ${currentRepetition}/${totalRepetitions}`;

    readyVoice(); // LLAMADA A LA VOZ "PREPARADO?"
    
    const delayToUse = getRandomDelay(minDelay, maxDelay);
    
    counterDisplay.textContent = '00.00';

    if (!speechAvailable) {
        statusDisplay.textContent = `PREPARACIÓN... ESPERANDO SEÑAL`;
    } else {
        statusDisplay.textContent = `ESPERANDO SEÑAL...`;
    }

    // Paso 1: Espera el Retardo Aleatorio -> startBeep
    mainTimerId = setTimeout(() => {
        if (!isRunningDryFire) return;
        
        startBeep();
        
        // Paso 2: Espera el Tiempo Límite -> parTimeBeep y programar descanso
        mainTimerId = setTimeout(() => {
            if (!isRunningDryFire) return;

            parTimeBeep();
            
            // Programar el descanso y el siguiente set
            if (currentRepetition < totalRepetitions) {
                const rest = parseFloat(restTimeInput.value) * 1000;
                statusDisplay.textContent = `¡HECHO! DESCANSO. PRÓXIMO SET EN ${rest / 1000}s...`;
                mainTimerId = setTimeout(runRepetition, rest); 
            } else {
                stopDryFire(true);
            }

        }, parTimeMs);
        
    }, delayToUse); 
}


// FUNCIÓN DE INICIO DRY FIRE
function startDryFire() {
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
}

// Detiene el temporizador DRY FIRE
function stopDryFire(completed = false) {
    clearTimeout(mainTimerId);
    stopTimerDisplay();
    isRunningDryFire = false;
    
    if (speechAvailable) {
        window.speechSynthesis.cancel();
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
}

function createDryFireLogEntry(setNumber, minDelay, maxDelay, parTime) {
    const row = logTableBody.insertRow();
    row.id = `set-${setNumber}`;
    
    let cell1 = row.insertCell();
    cell1.textContent = setNumber;

    let cell2 = row.insertCell();
    cell2.textContent = `${minDelay.toFixed(1)} - ${maxDelay.toFixed(1)} s`; 

    let cell3 = row.insertCell();
    cell3.textContent = parTime.toFixed(2) + ' s'; 
    
    let cell4 = row.insertCell();
    cell4.textContent = parTime.toFixed(2) + ' s';
    
    logTableBody.appendChild(row);
    return row;
}

// ... (El resto de funciones del Dry Fire como toggleDryFireControls, updateDryFireInterfaceByMode, etc., permanecen sin cambios)

function clearDryFireLog() {
    logTableBody.innerHTML = '';
}

function toggleDryFireControls(disable) {
    startButton.disabled = disable;
    stopButton.disabled = !disable;
    parTimeInput.disabled = disable;
    repetitionsInput.disabled = disable;
    restTimeInput.disabled = disable;
    modeSelector.disabled = disable;
    
    const mode = modeSelector.value;
    
    if (mode === 'pro') {
        minDelayInput.disabled = true;
        maxDelayInput.disabled = true;
    } else if (mode === 'manual') {
        minDelayInput.disabled = disable;
    }
}

function updateDryFireInterfaceByMode() {
    const mode = modeSelector.value;
    
    if (mode === 'pro') {
        minDelayLabel.textContent = 'RETARDO MIN. (s)';
        maxDelayGroup.style.display = 'flex'; 
        minDelayInput.disabled = true; 
        maxDelayInput.disabled = true; 
    } else if (mode === 'manual') {
        minDelayLabel.textContent = 'RETARDO (s)'; 
        maxDelayGroup.style.display = 'none'; 
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
    if (mode === 'random') {
        mmaRoundTimeInput.classList.add('hidden');
        mmaRoundTimeInput.disabled = true;
        mmaRandomRangeGroup.classList.remove('hidden');
        mmaMinRoundInput.disabled = false;
        mmaMaxRoundInput.disabled = false;
    } else {
        mmaRoundTimeInput.classList.remove('hidden');
        mmaRoundTimeInput.disabled = false;
        mmaRandomRangeGroup.classList.add('hidden');
    }
}

function getRoundDuration() {
    const mode = mmaModeSelector.value;
    if (mode === 'random') {
        const min = parseInt(mmaMinRoundInput.value) * 60;
        const max = parseInt(mmaMaxRoundInput.value) * 60;
        
        const effectiveMin = Math.max(min, 180); 
        
        const randomMinutes = Math.floor(Math.random() * ((max / 60) - (effectiveMin / 60) + 1)) + (effectiveMin / 60);
        
        return randomMinutes * 60; 
        
    } else {
        return parseInt(mmaRoundTimeInput.value) * 60; 
    }
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
    
    if (speechAvailable) {
        window.speechSynthesis.cancel();
    }
    
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
    mmaRoundTimeInput.disabled = (mmaModeSelector.value === 'fixed' ? disable : true);
    mmaMinRoundInput.disabled = (mmaModeSelector.value === 'random' ? disable : true);
    mmaMaxRoundInput.disabled = (mmaModeSelector.value === 'random' ? disable : true);
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

    // 1. INICIAR ASALTO (ROUND)
    currentRound++;
    isRoundTime = true;
    currentRoundDuration = getRoundDuration();
    
    mmaLogEntry('ASALTO', currentRound, currentRoundDuration / 60, currentRestDuration);

    mmaStatusDisplay.textContent = '¡ASALTO!';
    mmaCurrentRoundDisplay.textContent = `ASALTO: ${currentRound}/${totalRounds} - ESTADO: ASALTO`;
    playBeep(800, 500); 
    
    startMMACounter(currentRoundDuration, startRest);
}

function startRest() {
    if (!isRunningMMA) return;

    // 2. INICIAR DESCANSO (REST)
    isRoundTime = false;
    
    if (currentRound < totalRounds) {
        mmaStatusDisplay.textContent = '¡TIEMPO! DESCANSO.';
        mmaCurrentRoundDisplay.textContent = `ASALTO: ${currentRound}/${totalRounds} - ESTADO: DESCANSO`;
        playBeep(400, 500); 
        
        mmaLogEntry('DESCANSO', currentRound, currentRoundDuration / 60, currentRestDuration);
        
        startMMACounter(currentRestDuration, runMMASequence); 
    } else {
        runMMASequence(); 
    }
}

function startMMACounter(duration, callback) {
    let timeLeft = duration;
    
    clearInterval(mmaTimerId); 

    function updateCounter() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        mmaCounterDisplay.textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (timeLeft === 10) {
            if (speechAvailable) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance("Diez segundos"));
            }
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
    
    let cell1 = row.insertCell();
    cell1.textContent = roundNum;

    let cell2 = row.insertCell();
    cell2.textContent = `${roundTimeMin.toFixed(1)} min`;

    let cell3 = row.insertCell();
    cell3.textContent = `${restTimeSec} s`;
    
    let cell4 = row.insertCell();
    cell4.textContent = type;
    cell4.style.fontWeight = 'bold';
    cell4.style.color = (type === 'ASALTO' ? '#00e676' : '#ff3d00'); 
}


// ----------------------------------------------------
// --- GLOBAL EVENT LISTENERS & UI SWITCHING ---
// ----------------------------------------------------

function setDryFireStyle() {
    const green = '#00e676';
    const greenShadow = '0 0 5px rgba(0, 230, 118, 0.7)';
    
    container.style.borderColor = green;
    displayArea.style.borderColor = green;
    headerMotto.style.color = green;
    headerMotto.style.borderBottomColor = green;
    
    document.querySelector('h1').style.color = green;
    document.querySelector('h1').style.textShadow = greenShadow;
    document.getElementById('counter').style.color = green;
    
    document.getElementById('startButton').style.backgroundColor = green;
    document.getElementById('stopButton').style.backgroundColor = '#ff3d00';
}

function setMMAStyle() {
    const red = '#ff3d00';
    const redShadow = '0 0 5px rgba(255, 61, 0, 0.7)';

    container.style.borderColor = red;
    displayArea.style.borderColor = red;
    headerMotto.style.color = red;
    headerMotto.style.borderBottomColor = red;
    
    document.querySelector('h1').style.color = red;
    document.querySelector('h1').style.textShadow = redShadow;
    document.getElementById('mmaCounter').style.color = red;
    
    document.getElementById('mmaStartButton').style.backgroundColor = red;
    document.getElementById('mmaStopButton').style.backgroundColor = '#00e676';
}

// Lógica de cambio de pestaña
dryFireTab.addEventListener('click', () => {
    dryFireContent.classList.remove('hidden');
    mmaContent.classList.add('hidden');
    dryFireTab.classList.add('active');
    mmaTab.classList.remove('active');
    
    stopMMA(); 
    setDryFireStyle();
    updateDryFireInterfaceByMode();
});

mmaTab.addEventListener('click', () => {
    mmaContent.classList.remove('hidden');
    dryFireContent.classList.add('hidden');
    mmaTab.classList.add('active');
    dryFireTab.classList.remove('active');
    
    stopDryFire(false); 
    setMMAStyle();
    updateMMAInterfaceByMode();
});

// CORRECCIÓN DEFINITIVA DE INICIO DRY FIRE: Garantiza la activación de SpeechSynthesis.
startButton.addEventListener('click', async () => {
    // 1. Garantizamos que AudioContext esté listo para los pitidos
    await initAudioContext(); 
    
    // 2. Garantizamos que SpeechSynthesis esté activo (si es la primera vez)
    if (speechAvailable && !speechInitialized) {
        // Llamamos a readyVoice() directamente en el clic para despertar la API
        readyVoice(); 
        speechInitialized = true; 
        // Esperamos un breve momento para que la API se despierte antes de iniciar el flujo principal.
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
    
    // 3. Iniciamos el flujo del temporizador. runRepetition() llamará a readyVoice() de nuevo, que es lo esperado.
    startDryFire(); 
});

stopButton.addEventListener('click', () => stopDryFire(false));
modeSelector.addEventListener('change', updateDryFireInterfaceByMode);

// Event Listeners para MMA Timer 
mmaStartButton.addEventListener('click', startMMA);
mmaStopButton.addEventListener('click', stopMMA);
mmaModeSelector.addEventListener('change', updateMMAInterfaceByMode);


// Inicialización al cargar
document.addEventListener('DOMContentLoaded', () => {
    updateDryFireInterfaceByMode();
    updateMMAInterfaceByMode();
    setDryFireStyle(); 
    
    // Sincronizar retardo en modo manual
    minDelayInput.addEventListener('change', () => {
        if (modeSelector.value === 'manual') {
            maxDelayInput.value = minDelayInput.value;
        }
    });
});
