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
let speechAvailable = 'speechSynthesis' in window; // Comprobación de disponibilidad de voz

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

// 1. Pitido de INICIO (2000 Hz, 200 ms)
function startBeep() {
    playBeep(2000, 200); 
    statusDisplay.textContent = `¡FUEGO! COMPLETAR EJERCICIO`;
    startTimerDisplay();
}

// 2. Pitido de TIEMPO LÍMITE (Doble, bajo)
function parTimeBeep() {
    stopTimerDisplay(); 
    playBeep(400, 150);
    setTimeout(() => playBeep(400, 150), 200);

    statusDisplay.textContent = `TIEMPO LÍMITE ALCANZADO.`;
}

// 3. Voz PREPARADO?
function readyVoice() {
    if (speechAvailable) {
        window.speechSynthesis.cancel(); 
        
        const utterance = new SpeechSynthesisUtterance("PREPARADO?"); 
        utterance.lang = 'es-ES'; 
        utterance.rate = 1.0; 
        
        const voices = window.speechSynthesis.getVoices();
        const maleVoice = voices.find(voice => 
            (voice.lang === 'es-ES' || voice.lang.startsWith('es')) && 
            (voice.name.includes('Male') || voice.name.includes('Man') || voice.name.includes('masculino'))
        );

        if (maleVoice) {
            utterance.voice = maleVoice;
        } 
        
        window.speechSynthesis.speak(utterance);
    } else {
        statusDisplay.textContent = `PREPARADO... ESPERANDO SEÑAL`;
        console.warn("La API de síntesis de voz no está soportada o no está disponible.");
    }
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

function createLogEntry(setNumber, minDelay, maxDelay, parTime) {
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


// --- LÓGICA PRINCIPAL DE LOS MODOS (FLUJO CONTINUO) ---

function getRandomDelay(min, max) {
    const minMs = parseFloat(min) * 1000;
    const maxMs = parseFloat(max) * 1000;
    const delay = Math.random() * (maxMs - minMs) + minMs;
    // Si min == max (modo manual), Math.random() dará 0, así que solo devolvemos minMs
    if (minMs === maxMs) {
        return minMs;
    }
    return delay;
}

function runRepetition() {
    if (!isRunning) return;

    const currentMode = modeSelector.value;
    
    if (currentRepetition >= totalRepetitions) {
        stopTimer(true);
        return;
    }

    // 1. OBTENER PARÁMETROS DE RETARDO
    let minDelay = parseFloat(minDelayInput.value);
    let maxDelay = parseFloat(maxDelayInput.value);
    let parTime = parseFloat(parTimeInput.value);
    
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
    
    // *** CORRECCIÓN CLAVE AQUÍ: Solo validar si Min es MAYOR que Max, pero no si son iguales ***
    if (minDelay > maxDelay) { 
        statusDisplay.textContent = "ERROR: Retardo Min. debe ser menor o igual que el Máx.";
        stopTimer(false);
        return;
    }

    currentRepetition++;

    // El registro es SIEMPRE necesario
    createLogEntry(currentRepetition, minDelay, maxDelay, parTime); 
    currentSetDisplay.textContent = `Set: ${currentRepetition}/${totalRepetitions}`;

    // Llama a la voz "PREPARADO?"
    readyVoice();
    
    // Aseguramos que si es manual, el retardo sea solo el valor fijo.
    const delayToUse = (currentMode === 'manual') ? minDelay * 1000 : getRandomDelay(minDelay, maxDelay);
    
    counterDisplay.textContent = '00.00';

    if (!speechAvailable) {
        statusDisplay.textContent = `PREPARACIÓN... ESPERANDO SEÑAL`;
    } else {
        statusDisplay.textContent = `ESPERANDO SEÑAL...`;
    }

    // Paso 1: Espera el Retardo Aleatorio -> startBeep
    mainTimerId = setTimeout(() => {
        if (!isRunning) return;
        
        startBeep();
        
        // Paso 2: Espera el Tiempo Límite -> parTimeBeep y programar descanso
        mainTimerId = setTimeout(() => {
            if (!isRunning) return;

            parTimeBeep();
            
            // Programar el descanso y el siguiente set
            if (currentRepetition < totalRepetitions) {
                const rest = parseFloat(restTimeInput.value) * 1000;
                statusDisplay.textContent = `¡HECHO! DESCANSO. PRÓXIMO SET EN ${rest / 1000}s...`;
                mainTimerId = setTimeout(runRepetition, rest); 
            } else {
                stopTimer(true);
            }

        }, parTimeMs);
        
    }, delayToUse); // Usamos delayToUse
}


// FUNCIÓN DE INICIO
function startTimer() {
    if (isRunning) return;
    
    // totalRepetitions ahora siempre se lee del input
    totalRepetitions = parseInt(repetitionsInput.value);
    if (totalRepetitions < 1 || isNaN(totalRepetitions)) {
        alert("El número de Repeticiones debe ser 1 o más.");
        return;
    }

    currentRepetition = 0; 
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
    
    if (speechAvailable) {
        window.speechSynthesis.cancel();
    }
    
    toggleControls(false);
    
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


// Función auxiliar para gestionar la interfaz según el modo
function updateInterfaceByMode() {
    const mode = modeSelector.value;
    
    // Todos los grupos (ParTime, Repeticiones, Descanso, Log) ahora SIEMPRE están visibles.
    parTimeGroup.classList.remove('hidden');
    repetitionsGroup.classList.remove('hidden');
    restTimeGroup.classList.remove('hidden');
    repRestSeparator.classList.remove('hidden');
    logPanel.classList.remove('hidden');
    
    // Solo se gestiona el bloqueo de los inputs de retardo en modo 'pro'
    const disableDelayInputs = mode === 'pro';
    minDelayInput.disabled = disableDelayInputs;
    maxDelayInput.disabled = disableDelayInputs;
    
    if (mode === 'manual') {
        minDelayInput.disabled = false;
        maxDelayInput.disabled = false;
        // En modo manual, el rango es fijo (min=max para retardo fijo)
        // Ya no forzamos el valor aquí, sino con los listeners de cambio para permitir ajustes
        // y con la lógica de ejecución (getRandomDelay).
    }
    
    startButton.textContent = 'INICIAR';
    
    statusDisplay.textContent = 'CONFIGURA Y PULSA INICIAR';
    counterDisplay.textContent = '00.00';
    currentSetDisplay.textContent = 'Set: 0/0';
}


// --- GESTIÓN DE INTERFAZ Y EVENT LISTENERS ---

window.speechSynthesis.onvoiceschanged = function() {
    // Asegura que las voces se cargan para readyVoice
};


function toggleControls(disable) {
    startButton.disabled = disable;
    stopButton.disabled = !disable;
    parTimeInput.disabled = disable;
    repetitionsInput.disabled = disable;
    restTimeInput.disabled = disable;
    modeSelector.disabled = disable;
    
    const isPro = modeSelector.value === 'pro';
    
    // Solo deshabilitamos los retardos si el modo es Pro O si el timer está en ejecución
    const disableDelayInputs = isPro || disable;

    minDelayInput.disabled = disableDelayInputs;
    maxDelayInput.disabled = disableDelayInputs;

    // Si el modo es manual y no estamos corriendo, deben estar habilitados
    if (modeSelector.value === 'manual' && !disable) {
         minDelayInput.disabled = false;
         maxDelayInput.disabled = false;
    }
}


startButton.addEventListener('click', () => {
    initAudioContext(); 
    startTimer();
});

stopButton.addEventListener('click', () => stopTimer(false));
modeSelector.addEventListener('change', updateInterfaceByMode);
document.addEventListener('DOMContentLoaded', updateInterfaceByMode);

// Event Listeners para forzar que en modo manual min y max sean iguales al cambiarlos
document.addEventListener('DOMContentLoaded', () => {
    updateInterfaceByMode();

    minDelayInput.addEventListener('change', () => {
        if (modeSelector.value === 'manual') {
            maxDelayInput.value = minDelayInput.value;
        }
    });
    maxDelayInput.addEventListener('change', () => {
        if (modeSelector.value === 'manual') {
            minDelayInput.value = maxDelayInput.value;
        }
    });
});
