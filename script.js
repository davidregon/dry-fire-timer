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
let animationFrameId = null;
let startTime = 0;
let isRunning = false;

// --- DRY FIRE STATE ---
let currentRepetition = 0;
let totalRepetitions = 0;
let isCountingTime = false;

// --- MMA TIMER STATE ---
let mmaTimerId = null;
let currentRound = 0;
let totalRounds = 0;
let isRoundTime = false;
let currentRoundDuration = 0; // Duración del asalto en segundos
let currentRestDuration = 0; // Duración del descanso en segundos

// --- AUDIO/VOICE SETUP (Reuse existing functions: initAudioContext, playBeep) ---
let speechAvailable = 'speechSynthesis' in window; 

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.error("Error al reanudar AudioContext:", e));
    }
}

function playBeep(frequency, duration) {
    if (!audioContext) return;
    // ... (rest of playBeep implementation) ... 
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

// ----------------------------------------------------
// --- DRY FIRE TIMER LOGIC (Existing/Modified) ---
// ----------------------------------------------------

// ... (Todas las funciones startBeep, parTimeBeep, readyVoice, startTimerDisplay, 
//      stopTimerDisplay, updateTimerDisplay, clearLog, createLogEntry, 
//      getRandomDelay, runRepetition, startTimer, stopTimer, updateInterfaceByMode, 
//      toggleControls) ...

function updateInterfaceByMode() {
    // DRY FIRE LOGIC
    const mode = modeSelector.value;
    // ... (rest of updateInterfaceByMode for Dry Fire) ...
    const dryFireControls = document.querySelector('#dryFireContent .controls-panel');
    const dryFireButtons = document.querySelector('#dryFireContent .button-group');
    const dryFireLog = document.getElementById('logPanel');

    // Mantenemos la lógica de Dry Fire
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

function toggleControls(disable) {
    // DRY FIRE LOGIC
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
// ----------------------------------------------------
// --- MMA TIMER LOGIC (NEW) ---
// ----------------------------------------------------

function updateMMAInterfaceByMode() {
    const mode = mmaModeSelector.value;
    if (mode === 'random') {
        mmaRoundTimeInput.classList.add('hidden'); // Ocultamos el tiempo fijo
        mmaRoundTimeInput.disabled = true;
        mmaRandomRangeGroup.classList.remove('hidden'); // Mostramos el rango aleatorio
        mmaMinRoundInput.disabled = false;
        mmaMaxRoundInput.disabled = false;
    } else {
        mmaRoundTimeInput.classList.remove('hidden'); // Mostramos el tiempo fijo
        mmaRoundTimeInput.disabled = false;
        mmaRandomRangeGroup.classList.add('hidden'); // Ocultamos el rango aleatorio
    }
}

function getRoundDuration() {
    const mode = mmaModeSelector.value;
    if (mode === 'random') {
        const min = parseInt(mmaMinRoundInput.value) * 60; // Convertir a segundos
        const max = parseInt(mmaMaxRoundInput.value) * 60;
        
        // Asegurarse de que el mínimo sea al menos 3 minutos (180s)
        const effectiveMin = Math.max(min, 180); 
        
        // Generar un número aleatorio de minutos entre min/60 y max/60, y luego a segundos
        const randomMinutes = Math.floor(Math.random() * ((max / 60) - (effectiveMin / 60) + 1)) + (effectiveMin / 60);
        
        return randomMinutes * 60; // Devolver duración en segundos
        
    } else {
        return parseInt(mmaRoundTimeInput.value) * 60; // Asalto fijo en segundos
    }
}

function startMMA() {
    if (isRunning) return;
    initAudioContext();

    totalRounds = parseInt(mmaRoundsInput.value);
    currentRestDuration = parseInt(mmaRestTimeInput.value);
    
    if (totalRounds < 1 || isNaN(totalRounds)) {
        alert("El número de Asaltos debe ser 1 o más.");
        return;
    }

    // Reiniciar estado
    currentRound = 0;
    isRunning = true;
    mmaLogTableBody.innerHTML = '';
    mmaCounterDisplay.textContent = "00:00";
    mmaStatusDisplay.textContent = "¡PREPÁRATE!";
    
    // Deshabilitar controles
    mmaToggleControls(true);
    
    // Iniciar la secuencia con el primer descanso (o preparación)
    mmaCurrentRoundDisplay.textContent = `ASALTO: 0/${totalRounds} - ESTADO: PREPARACIÓN`;
    mmaTimerId = setTimeout(runMMASequence, 3000); // 3 segundos de preparación
}

function stopMMA() {
    clearTimeout(mmaTimerId);
    clearInterval(mmaTimerId); // Para el intervalo si está corriendo
    isRunning = false;
    
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
    if (!isRunning) return;

    if (currentRound >= totalRounds) {
        // FIN DEL ENTRENAMIENTO
        mmaStatusDisplay.textContent = '¡ENTRENAMIENTO COMPLETADO!';
        mmaCurrentRoundDisplay.textContent = 'ASALTO: COMPLETO';
        playBeep(400, 500); // Triple pitido final bajo
        setTimeout(() => playBeep(400, 500), 600);
        setTimeout(() => playBeep(400, 500), 1200);
        stopMMA();
        return;
    }

    // 1. INICIAR ASALTO (ROUND)
    currentRound++;
    isRoundTime = true;
    currentRoundDuration = getRoundDuration();
    
    // Log antes de iniciar
    mmaLogEntry('ASALTO', currentRound, currentRoundDuration / 60, currentRestDuration);

    mmaStatusDisplay.textContent = '¡ASALTO!';
    mmaCurrentRoundDisplay.textContent = `ASALTO: ${currentRound}/${totalRounds} - ESTADO: ASALTO`;
    playBeep(800, 500); // Pitido de inicio de asalto (alto)
    
    startMMACounter(currentRoundDuration, startRest);
}

function startRest() {
    if (!isRunning) return;

    // 2. INICIAR DESCANSO (REST)
    isRoundTime = false;
    
    if (currentRound < totalRounds) {
        mmaStatusDisplay.textContent = '¡TIEMPO! DESCANSO.';
        mmaCurrentRoundDisplay.textContent = `ASALTO: ${currentRound}/${totalRounds} - ESTADO: DESCANSO`;
        playBeep(400, 500); // Pitido de fin de asalto (bajo)
        
        // Log del DESCANSO (mismo round)
        mmaLogEntry('DESCANSO', currentRound, currentRoundDuration / 60, currentRestDuration);
        
        startMMACounter(currentRestDuration, runMMASequence); // Llama a la siguiente secuencia
    } else {
        runMMASequence(); // Termina
    }
}

function startMMACounter(duration, callback) {
    let timeLeft = duration;

    function updateCounter() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        mmaCounterDisplay.textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Alertas de voz o pitidos en los últimos segundos
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
    cell4.style.color = (type === 'ASALTO' ? '#00e676' : '#ff3d00'); // Verde para asalto, rojo para descanso
}

// ----------------------------------------------------
// --- GLOBAL EVENT LISTENERS ---
// ----------------------------------------------------

// Lógica de cambio de pestaña
dryFireTab.addEventListener('click', () => {
    dryFireContent.classList.remove('hidden');
    mmaContent.classList.add('hidden');
    dryFireTab.classList.add('active');
    mmaTab.classList.remove('active');
    // Asegurarse de detener el otro timer si está corriendo
    if (isRunning) stopMMA();
});

mmaTab.addEventListener('click', () => {
    mmaContent.classList.remove('hidden');
    dryFireContent.classList.add('hidden');
    mmaTab.classList.add('active');
    dryFireTab.classList.remove('active');
    // Asegurarse de detener el otro timer si está corriendo
    if (isRunning) stopTimer(false);
});

// Event Listeners para Dry Fire (se mantienen)
startButton.addEventListener('click', () => {
    initAudioContext(); 
    startTimer();
});
stopButton.addEventListener('click', () => stopTimer(false));
modeSelector.addEventListener('change', updateInterfaceByMode);

// Event Listeners para MMA Timer (nuevos)
mmaStartButton.addEventListener('click', startMMA);
mmaStopButton.addEventListener('click', stopMMA);
mmaModeSelector.addEventListener('change', updateMMAInterfaceByMode);


// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    updateInterfaceByMode();
    updateMMAInterfaceByMode();

    // Sincronizar retardo en modo manual
    minDelayInput.addEventListener('change', () => {
        if (modeSelector.value === 'manual') {
            maxDelayInput.value = minDelayInput.value;
        }
    });
});
