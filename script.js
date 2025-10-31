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

// Inicializa o reanuda el AudioContext (DEBE ser llamado por un evento de clic)
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Forzar reanudación en caso de que esté suspendido
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.error("Error al reanudar AudioContext:", e));
    }
}

// Función para generar un pitido
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
    
    // Conexión y volumen
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

    statusDisplay.textContent = `TIEMPO PAR FINALIZADO.`;
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

// --- LÓGICA DE REGISTRO ---

function clearLog() {
    logTableBody.innerHTML = '';
}

function createLogEntry(setNumber, parTime) {
    const row = logTableBody.insertRow();
    row.id = `set-${setNumber}`;
    
    let cell1 = row.insertCell();
    cell1.textContent = setNumber;
    
    let cell2 = row.insertCell();
    cell2.textContent = parTime;

    let cell3 = row.insertCell();
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '0.00';
    input.disabled = true; 
    
    cell3.appendChild(input);
    
    // Listener para programar el siguiente set al pulsar ENTER
    input.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
             const timeValue = parseFloat(input.value);
             if (isNaN(timeValue) || timeValue <= 0) {
                 input.value = '';
                 input.placeholder = 'Inválido';
                 return;
             }
             
             input.disabled = true; 
             
             // Si aún quedan repeticiones, programar el descanso y el siguiente set
             if (isRunning && currentRepetition <= totalRepetitions) {
                 const rest = parseFloat(restTimeInput.value) * 1000;
                 statusDisplay.textContent = `DESCANSO. PRÓXIMO SET EN ${rest / 1000}s...`;
                 mainTimerId = setTimeout(runRepetition, rest); 
             } else if (currentRepetition > totalRepetitions) {
                 // Si fue el último set
                 stopTimer(true); 
             }
        }
    });

    logTableBody.appendChild(row);
    return row;
}


// --- LÓGICA PRINCIPAL DE LOS MODOS ---

function getRandomDelay(min, max) {
    const minMs = parseFloat(min) * 1000;
    const maxMs = parseFloat(max) * 1000;
    const delay = Math.random() * (maxMs - minMs) + minMs;
    return delay;
}

function runRepetition() {
    if (!isRunning) return;

    const currentMode = modeSelector.value;
    
    if (currentMode !== 'free') {
        if (currentRepetition > totalRepetitions) {
            stopTimer(true);
            return;
        }
    } else {
        // En modo libre, la cuenta solo es para referencia
        currentRepetition++;
    }

    // 1. OBTENER PARÁMETROS DE RETARDO
    let minDelay = parseFloat(minDelayInput.value);
    let maxDelay = parseFloat(maxDelayInput.value);
    let parTime = parseFloat(parTimeInput.value);
    
    // Lógica para Modo Aleatorio PRO: Retardos variables en cada set
    if (currentMode === 'pro') {
        // Rango amplio para la variación
        const rangeMin = 1.0;
        const rangeMax = 6.0;

        // Nuevos min y max generados de forma aleatoria y luego ajustados
        const newMin = Math.random() * (rangeMax - rangeMin) + rangeMin;
        const newMax = newMin + (Math.random() * (rangeMax - newMin - 0.5)) + 0.5;
        
        minDelay = parseFloat(newMin.toFixed(1));
        maxDelay = parseFloat(newMax.toFixed(1));
        
        // Actualizar la interfaz para que el usuario sepa los nuevos parámetros de este set
        minDelayInput.value = minDelay;
        maxDelayInput.value = maxDelay;
    }

    const parTimeMs = parTime * 1000;
    
    if (minDelay >= maxDelay) {
        statusDisplay.textContent = "ERROR: Retardo Min. debe ser menor que el Máx.";
        stopTimer(false);
        return;
    }

    let currentRow = null;
    if (currentMode === 'manual' || currentMode === 'pro') {
        currentRow = createLogEntry(currentRepetition, parTime.toFixed(2));
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
        
        // Paso 2: (Solo si NO es Modo Libre) Espera el Tiempo Par -> parTimeBeep
        if (currentMode === 'manual' || currentMode === 'pro') {
            mainTimerId = setTimeout(() => {
                if (!isRunning) return;

                parTimeBeep();
                
                // Habilitar input de registro
                const inputField = currentRow.querySelector('input');
                if (inputField) {
                    inputField.disabled = false;
                    inputField.focus();
                }
                
                currentRepetition++;
                
                if (currentRepetition <= totalRepetitions) {
                    statusDisplay.textContent += ' REGISTRA TU TIEMPO y pulsa ENTER.';
                } else {
                     statusDisplay.textContent = 'ÚLTIMO SET. REGISTRA TU TIEMPO y pulsa ENTER.';
                }

            }, parTimeMs);
        } else {
            // Lógica para Modo Libre: Solo hay beep de inicio, luego pasa al descanso
            const rest = parseFloat(restTimeInput.value) * 1000;
            statusDisplay.textContent = `DESCANSO. PRÓXIMO INICIO EN ${rest / 1000}s...`;
            
            // Programar el siguiente set de Modo Libre
            mainTimerId = setTimeout(runRepetition, rest);
        }
        
    }, randomDelay);
}


// FUNCIÓN DE INICIO CON LÓGICA DE MODO
function startTimer() {
    if (isRunning) return;
    
    const currentMode = modeSelector.value;
    
    // Validación general para modos no libres
    if (currentMode !== 'free') {
        totalRepetitions = parseInt(repetitionsInput.value);
        if (totalRepetitions < 1 || isNaN(totalRepetitions)) {
            alert("El número de Repeticiones debe ser 1 o más.");
            return;
        }
    } else {
        totalRepetitions = '∞'; // Infinito para el modo libre
    }

    currentRepetition = 1;
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

    // Si se detiene manualmente antes del input, deshabilitar campos abiertos
    document.querySelectorAll('#logTable input:not([disabled])').forEach(input => input.disabled = true);
    
    if (completed) {
        statusDisplay.textContent = 'ENTRENAMIENTO COMPLETADO';
        counterDisplay.textContent = 'FIN';
    } else {
        statusDisplay.textContent = `DETENIDO. ${currentRepetition > 1 ? currentRepetition - 1 : 0} SETS REALIZADOS`;
        counterDisplay.textContent = 'PAUSA';
    }
    currentSetDisplay.textContent = 'Set: 0/0';
}


// Función auxiliar para gestionar la interfaz según el modo
function updateInterfaceByMode() {
    const mode = modeSelector.value;
    
    // Ocultar/Mostrar Par Time
    const showParTime = mode !== 'free';
    parTimeGroup.classList.toggle('hidden', !showParTime);

    // Ocultar/Mostrar Repeticiones y Descanso
    const showRepRest = mode !== 'free';
    repetitionsGroup.classList.toggle('hidden', !showRepRest);
    restTimeGroup.classList.toggle('hidden', !showRepRest);
    repRestSeparator.classList.toggle('hidden', !showRepRest);

    // Ocultar/Mostrar Log
    const showLog = mode === 'manual' || mode === 'pro';
    logPanel.classList.toggle('hidden', !showLog);
    
    // Habilitar/Deshabilitar Retardos en modo 'pro' (para dejar claro que cambian solos)
    const disableDelayInputs = mode === 'pro';
    minDelayInput.disabled = disableDelayInputs;
    maxDelayInput.disabled = disableDelayInputs;
    
    // Si se pasa de Pro a Manual/Libre, restaurar el estado de los inputs
    if (mode !== 'pro') {
        minDelayInput.disabled = false;
        maxDelayInput.disabled = false;
    }
    
    // Mensaje en el botón (opcional)
    startButton.textContent = (mode === 'free') ? 'INICIAR (LIBRE)' : 'INICIAR';
    
    // Resetear display
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
    
    // Mantener la deshabilitación del Retardo en modo Pro incluso al iniciar
    if (modeSelector.value !== 'pro') {
        minDelayInput.disabled = disable;
        maxDelayInput.disabled = disable;
    }
}

// Inicializar el AudioContext en el evento de clic del botón (Garantía de Sonido)
startButton.addEventListener('click', () => {
    initAudioContext(); 
    startTimer();
});

stopButton.addEventListener('click', () => stopTimer(false));

// Listener para cambiar la interfaz al seleccionar el modo
modeSelector.addEventListener('change', updateInterfaceByMode);

// Inicializar la interfaz al cargar la página
document.addEventListener('DOMContentLoaded', updateInterfaceByMode);
