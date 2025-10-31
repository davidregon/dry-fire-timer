// Referencias a los elementos del DOM
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
const logPanel = document.getElementById('logPanel'); 
const parTimeGroup = document.getElementById('parTimeGroup');
const repetitionsGroup = document.getElementById('repetitionsGroup');
const restTimeGroup = document.getElementById('restTimeGroup');
const repRestSeparator = document.getElementById('repRestSeparator');

// Variables de estado del Timer
let audioContext = null; 
let mainTimerId = null;
let animationFrameId = null;
let startTime = 0;
let currentRepetition = 0;
let totalRepetitions = 0;
let isRunning = false;
let isCountingTime = false;

// --- FUNCIONES DE AUDIO GARANTIZADAS ---

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.error("Error al reanudar AudioContext:", e));
    }
}

function playBeep(frequency, duration) {
    if (!audioContext) {
        console.warn("AudioContext no inicializado. Asegúrese de hacer clic en 'Iniciar'.");
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

// 1. Pitido de INICIO (High Beep)
function startBeep() {
    playBeep(1500, 100); 
    statusDisplay.textContent = `¡FUEGO! COMPLETAR EJERCICIO`;
    startTimerDisplay();
}

// 2. Pitido de PAR TIME (Double Low Beep)
function parTimeBeep() {
    stopTimerDisplay(); 
    playBeep(400, 150);
    setTimeout(() => playBeep(400, 150), 200);

    statusDisplay.textContent = `TIEMPO LÍMITE ALCANZADO.`;
}

// --- FUNCIONES DE CRONÓMETRO DE ALTA PRECISIÓN ---

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
    
    // Formatear a S.cs (Segundos.Centésimas)
    const seconds = Math.floor(elapsedTime / 1000);
    const centiseconds = Math.floor((elapsedTime % 1000) / 10);

    const formattedTime = `${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    counterDisplay.textContent = formattedTime;

    animationFrameId = requestAnimationFrame(updateTimerDisplay);
}

// --- LÓGICA DE REGISTRO AUTOMÁTICO ---

function clearLog() {
    logTableBody.innerHTML = '';
}

// Crea una fila en el historial con la configuración del set
function createLogEntry(setNumber, minDelay, maxDelay, parTime) {
    const row = logTableBody.insertRow();
    row.id = `set-${setNumber}`;
    
    // 1. Set Number
    let cell1 = row.insertCell();
    cell1.textContent = setNumber;

    // 2. Start Delay Range
    let cell2 = row.insertCell();
    cell2.textContent = `${minDelay.toFixed(1)} - ${maxDelay.toFixed(1)} s`;

    // 3. Par Time
    let cell3 = row.insertCell();
    cell3.textContent = parTime.toFixed(2) + ' s'; 
    
    // 4. Tiempo Límite (El tiempo límite es el Par Time)
    let cell4 = row.insertCell();
    cell4.textContent = parTime.toFixed(2) + ' s';
    
    logTableBody.appendChild(row);
    return row;
}


// --- LÓGICA PRINCIPAL DE LOS MODOS (FLUJO CONTINUO) ---

function getRandomDelay(min, max) {
    const minMs = parseFloat(min) * 1000;
    const maxMs = parseFloat(max) * 1000;
    const delay = Math.random() * (maxMs - minMs) + minMs;
    return delay;
}

function runRepetition() {
    if (!isRunning) return;

    const currentMode = modeSelector.value;
    
    // Si no es Modo Libre y ya se terminaron las repeticiones, detener.
    if (currentMode !== 'free' && currentRepetition > totalRepetitions) {
        stopTimer(true);
        return;
    }

    // 1. OBTENER PARÁMETROS DE RETARDO
    let minDelay = parseFloat(minDelayInput.value);
    let maxDelay = parseFloat(maxDelayInput.value);
    let parTime = parseFloat(parTimeInput.value);
    
    // Lógica para Modo Aleatorio PRO: Retardos variables en cada set
    if (currentMode === 'pro') {
        const rangeMin = 1.0;
        const rangeMax = 6.0;

        const newMin = Math.random() * (rangeMax - rangeMin) + rangeMin;
        const newMax = newMin + (Math.random() * (rangeMax - newMin - 0.5)) + 0.5;
        
        minDelay = parseFloat(newMin.toFixed(1));
        maxDelay = parseFloat(newMax.toFixed(1));
        
        // Actualizar la interfaz para el usuario
        minDelayInput.value = minDelay;
        maxDelayInput.value = maxDelay;
    }

    const parTimeMs = parTime * 1000;
    
    if (minDelay >= maxDelay) {
        statusDisplay.textContent = "ERROR: Retardo Min. debe ser menor que el Máx.";
        stopTimer(false);
        return;
    }

    // Aumentar la repetición aquí, antes de correr el set
    currentRepetition++;

    // Registro automático antes de iniciar el set (solo Manual/Pro)
    if (currentMode === 'manual' || currentMode === 'pro') {
        createLogEntry(currentRepetition, minDelay, maxDelay, parTime); 
        currentSetDisplay.textContent = `Set: ${currentRepetition}/${totalRepetitions}`;
    } else {
         currentSetDisplay.textContent = `Libre Set: ${currentRepetition}`;
    }

    const randomDelay = getRandomDelay(minDelay, maxDelay);
    
    counterDisplay.textContent = '00.00';
    statusDisplay.textContent = `PREPARACIÓN... ESPERANDO SEÑAL`;

    // Paso 1: Espera el Retardo Aleatorio -> startBeep
    mainTimerId = setTimeout(() => {
        if (!isRunning) return;
        
        startBeep();
        
        // Paso 2: (Solo si NO es Modo Libre) Espera el Tiempo Par -> parTimeBeep y programar siguiente set
        if (currentMode === 'manual' || currentMode === 'pro') {
            mainTimerId = setTimeout(() => {
                if (!isRunning) return;

                parTimeBeep();
                
                // *** Flujo continuo: programar el descanso inmediatamente ***
                if (currentRepetition < totalRepetitions) {
                    const rest = parseFloat(restTimeInput.value) * 1000;
                    statusDisplay.textContent = `¡HECHO! DESCANSO. PRÓXIMO SET EN ${rest / 1000}s...`;
                    mainTimerId = setTimeout(runRepetition, rest);
                } else {
                    // Todas las repeticiones completadas
                    stopTimer(true);
                }

            }, parTimeMs);
        } else {
            // Lógica para Modo Libre: Solo hay beep de inicio, luego pasa al descanso
            const rest = parseFloat(restTimeInput.value) * 1000;
            statusDisplay.textContent = `DESCANSO. PRÓXIMO INICIO EN ${rest / 1000}s...`;
            
            mainTimerId = setTimeout(runRepetition, rest);
        }
        
    }, randomDelay);
}


// FUNCIÓN DE INICIO
function startTimer() {
    if (isRunning) return;
    
    const currentMode = modeSelector.value;
    
    if (currentMode !== 'free') {
        totalRepetitions = parseInt(repetitionsInput.value);
        if (totalRepetitions < 1 || isNaN(totalRepetitions)) {
            alert("El número de Repeticiones debe ser 1 o más.");
            return;
        }
    } else {
        totalRepetitions = '∞'; 
    }

    currentRepetition = 0; // Comenzamos en 0 para que la primera llamada a runRepetition lo suba a 1
    isRunning = true;
    
    toggleControls(true);
    clearLog();
    runRepetition();
}

// Detiene el temporizador
function stopTimer(completed = false) {
    clearTimeout(mainTimerId);
    stopTimerDisplay();
    isRunning = false;
    
    toggleControls(false);
    
    if (completed) {
        statusDisplay.textContent = 'ENTRENAMIENTO COMPLETADO';
        counterDisplay.textContent = 'FIN';
    } else {
        // currentRepetition se incrementa antes de correr, así que restamos 1 para el set actual
        const setsDone = currentRepetition > 0 ? currentRepetition - 1 : 0;
        statusDisplay.textContent = `DETENIDO. ${setsDone} SETS REALIZADOS`;
        counterDisplay.textContent = 'PAUSA';
    }
    currentSetDisplay.textContent = 'Set: 0/0';
}


// Función auxiliar para gestionar la interfaz según el modo
function updateInterfaceByMode() {
    const mode = modeSelector.value;
    
    const showParTime = mode !== 'free';
    parTimeGroup.classList.toggle('hidden', !showParTime);

    const showRepRest = mode !== 'free';
    repetitionsGroup.classList.toggle('hidden', !showRepRest);
    restTimeGroup.classList.toggle('hidden', !showRepRest);
    repRestSeparator.classList.toggle('hidden', !showRepRest);

    const showLog = mode === 'manual' || mode === 'pro';
    logPanel.classList.toggle('hidden', !showLog);
    
    // Deshabilitar Retardos en modo 'pro' para indicar que cambian solos
    const disableDelayInputs = mode === 'pro';
    minDelayInput.disabled = disableDelayInputs;
    maxDelayInput.disabled = disableDelayInputs;
    
    if (mode !== 'pro') {
        minDelayInput.disabled = false;
        maxDelayInput.disabled = false;
    }
    
    startButton.textContent = (mode === 'free') ? 'INICIAR (LIBRE)' : 'INICIAR';
    
    statusDisplay.textContent = 'CONFIGURA Y PULSA INICIAR';
    counterDisplay.textContent = '00.00';
    currentSetDisplay.textContent = 'Set: 0/0';
}


// --- GESTIÓN DE INTERFAZ Y EVENT LISTENERS ---

function toggleControls(disable) {
    startButton.disabled = disable;
    stopButton.disabled = !disable;
    parTimeInput.disabled = disable;
    repetitionsInput.disabled = disable;
    restTimeInput.disabled = disable;
    modeSelector.disabled = disable;
    
    if (modeSelector.value !== 'pro') {
        minDelayInput.disabled = disable;
        maxDelayInput.disabled = disable;
    }
}

startButton.addEventListener('click', () => {
    initAudioContext(); 
    startTimer();
});

stopButton.addEventListener('click', () => stopTimer(false));
modeSelector.addEventListener('change', updateInterfaceByMode);
document.addEventListener('DOMContentLoaded', updateInterfaceByMode);
