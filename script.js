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

// REFERENCIAS PARA GESTIÓN DE INTERFAZ
const minDelayGroup = document.getElementById('minDelayGroup');
const maxDelayGroup = document.getElementById('maxDelayGroup');
const minDelayLabel = document.getElementById('minDelayLabel');

// Variables de estado del Timer
let audioContext = null; 
let mainTimerId = null;
let animationFrameId = null;
let startTime = 0;
let currentRepetition = 0;
let totalRepetitions = 0;
let isRunning = false;
let isCountingTime = false;
let speechAvailable = 'speechSynthesis' in window; 

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
    // Usamos el valor real de minDelay y maxDelay registrado
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

    // 1. OBTENER Y AJUSTAR PARÁMETROS DE RETARDO
    let minDelay = parseFloat(minDelayInput.value);
    let maxDelay = parseFloat(maxDelayInput.value);
    let parTime = parseFloat(parTimeInput.value);
    
    if (currentMode === 'manual') {
         // ** CORRECCIÓN: Aseguramos que el valor Máximo sea igual al Mínimo **
         maxDelay = minDelay;
         maxDelayInput.value = minDelay; // Sincroniza el input oculto
    }
    
    if (currentMode === 'pro') {
        const rangeMin = 1.0;
        const rangeMax = 6.0;

        const newMin = Math.random() * (rangeMax - rangeMin) + rangeMin;
        const newMax = newMin + (Math.random() * (rangeMax - newMin - 0.5)) + 0.5;
        
        minDelay = parseFloat(newMin.toFixed(1));
        maxDelay = parseFloat(newMax.toFixed(1));
        
        // Actualizar inputs visibles con los nuevos valores aleatorios
        minDelayInput.value = minDelay;
        maxDelayInput.value = maxDelay;
    }

    const parTimeMs = parTime * 1000;
    
    // Validar solo si Min es ESTRICTAMENTE MAYOR que Max
    if (minDelay > maxDelay) { 
        statusDisplay.textContent = "ERROR: Retardo Min. debe ser menor o igual que el Máx.";
        stopTimer(false);
        return;
    }

    currentRepetition++;

    // El registro es SIEMPRE necesario
    // Usamos los valores ajustados para el log
    createLogEntry(currentRepetition, minDelay, maxDelay, parTime); 
    currentSetDisplay.textContent = `Set: ${currentRepetition}/${totalRepetitions}`;

    // Llama a la voz "PREPARADO?"
    readyVoice();
    
    // Calcular el retardo (fijo si min=max, aleatorio si min<max)
    const delayToUse = getRandomDelay(minDelay, maxDelay);
    
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
        
    }, delayToUse); 
}


// FUNCIÓN DE INICIO
function startTimer() {
    if (isRunning) return;
    
    totalRepetitions = parseInt(repetitionsInput.value);
    if (totalRepetitions < 1 || isNaN(totalRepetitions)) {
        alert("El número de Repeticiones debe ser 1 o más.");
        return;
    }
    
    // ** CORRECCIÓN: Nos aseguramos de sincronizar antes de iniciar **
    if (modeSelector.value === 'manual') {
        maxDelayInput.value = minDelayInput.value;
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
    
    // Los demás grupos siempre visibles
    parTimeGroup.classList.remove('hidden');
    repetitionsGroup.classList.remove('hidden');
    restTimeGroup.classList.remove('hidden');
    repRestSeparator.classList.remove('hidden');
    logPanel.classList.remove('hidden');
    
    if (mode === 'pro') {
        // MODO PRO: Retardo Min. y Retardo Max. (Ambos deshabilitados al ser automáticos)
        minDelayLabel.textContent = 'RETARDO MIN. (s)';
        maxDelayGroup.style.display = 'flex'; // Mostrar Retardo Máximo
        
        // Bloqueo de edición del modo PRO (Corrección 3)
        minDelayInput.disabled = true; 
        maxDelayInput.disabled = true; 
        
    } else if (mode === 'manual') {
        // MODO MANUAL: Solo un campo llamado RETARDO (Habilitado para edición)
        minDelayLabel.textContent = 'RETARDO (s)'; 
        maxDelayGroup.style.display = 'none'; // Ocultar Retardo Máximo
        
        minDelayInput.disabled = false; // Habilitar edición en Manual
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
    
    const mode = modeSelector.value;
    
    if (mode === 'pro') {
        // En PRO, los inputs de retardo SIEMPRE están deshabilitados
        minDelayInput.disabled = true;
        maxDelayInput.disabled = true;
    } else if (mode === 'manual') {
        // En Manual: El único input (minDelay) se deshabilita si está corriendo
        minDelayInput.disabled = disable;
    }
}


startButton.addEventListener('click', () => {
    initAudioContext(); 
    startTimer();
});

stopButton.addEventListener('click', () => stopTimer(false));
modeSelector.addEventListener('change', updateInterfaceByMode);
document.addEventListener('DOMContentLoaded', updateInterfaceByMode);

// Event Listener para sincronizar maxDelayInput con minDelayInput en modo Manual (aunque esté oculto)
document.addEventListener('DOMContentLoaded', () => {
    updateInterfaceByMode();

    minDelayInput.addEventListener('change', () => {
        if (modeSelector.value === 'manual') {
            // Sincronizar el valor del input Máximo (oculto)
            maxDelayInput.value = minDelayInput.value;
        }
    });
});
