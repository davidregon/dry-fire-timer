// Referencias a los elementos del DOM
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

// 1. Pitido de INICIO
function startBeep() {
    playBeep(1500, 100); 
    statusDisplay.textContent = `¡FUEGO! COMPLETAR EJERCICIO`;
    startTimerDisplay();
}

// 2. Pitido de PAR TIME
function parTimeBeep() {
    stopTimerDisplay(); 
    playBeep(400, 150);
    setTimeout(() => playBeep(400, 150), 200);

    statusDisplay.textContent = `TIEMPO PAR FINALIZADO. REGISTRA TU TIEMPO.`;
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
             // Validar formato (opcional pero recomendado)
             const timeValue = parseFloat(input.value);
             if (isNaN(timeValue) || timeValue <= 0) {
                 input.value = '';
                 input.placeholder = 'Inválido';
                 return;
             }
             
             // Deshabilitar la entrada después de registrar
             input.disabled = true; 
             
             // Si el timer está en descanso, iniciar el siguiente set
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

// --- LÓGICA PRINCIPAL DEL ENTRENAMIENTO ---

function getRandomDelay(min, max) {
    const minMs = parseFloat(min) * 1000;
    const maxMs = parseFloat(max) * 1000;
    const delay = Math.random() * (maxMs - minMs) + minMs;
    return delay;
}

function runRepetition() {
    if (!isRunning) return;

    if (currentRepetition > totalRepetitions) {
        stopTimer(true);
        return;
    }

    const min = minDelayInput.value;
    const max = maxDelayInput.value;
    const parTimeMs = parseFloat(parTimeInput.value) * 1000;

    if (parseFloat(min) >= parseFloat(max)) {
        statusDisplay.textContent = "ERROR: Retardo Min. debe ser menor que el Máx.";
        stopTimer(false);
        return;
    }
    
    const currentRow = createLogEntry(currentRepetition, parTimeInput.value);
    
    currentSetDisplay.textContent = `Set: ${currentRepetition}/${totalRepetitions}`;

    const randomDelay = getRandomDelay(min, max);
    
    counterDisplay.textContent = '00.00';
    statusDisplay.textContent = `PREPARACIÓN... ESPERANDO SEÑAL (Set ${currentRepetition})`;

    // Paso 1: Espera el Retardo Aleatorio -> startBeep
    mainTimerId = setTimeout(() => {
        if (!isRunning) return;
        
        startBeep();
        
        // Paso 2: Espera el Tiempo Par -> parTimeBeep
        mainTimerId = setTimeout(() => {
            if (!isRunning) return;

            parTimeBeep();
            
            // Al sonar el Pitido Par, habilitar el campo de entrada y enfocarlo
            const inputField = currentRow.querySelector('input');
            if (inputField) {
                inputField.disabled = false;
                inputField.focus();
            }
            
            currentRepetition++;
            
            // Si es la última repetición, no programamos descanso, solo esperamos el registro del usuario.
            if (currentRepetition <= totalRepetitions) {
                // El siguiente set se programa al pulsar ENTER en el campo de registro.
                statusDisplay.textContent += ' REGISTRA TU TIEMPO y pulsa ENTER.';
            } else {
                 statusDisplay.textContent = 'ÚLTIMO SET. REGISTRA TU TIEMPO y pulsa ENTER.';
            }

        }, parTimeMs);
        
    }, randomDelay);
}

// Inicia el temporizador
function startTimer() {
    if (isRunning) return;

    totalRepetitions = parseInt(repetitionsInput.value);
    
    if (totalRepetitions < 1) {
        alert("El número de Repeticiones debe ser 1 o más.");
        return;
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

function toggleControls(disable) {
    startButton.disabled = disable;
    stopButton.disabled = !disable;
    minDelayInput.disabled = disable;
    maxDelayInput.disabled = disable;
    parTimeInput.disabled = disable;
    repetitionsInput.disabled = disable;
    restTimeInput.disabled = disable;
}

// EVENT LISTENERS CLAVE
// 🎯 Inicializar el AudioContext en el evento de clic del botón (Garantía de Sonido)
startButton.addEventListener('click', () => {
    initAudioContext(); 
    startTimer();
});

stopButton.addEventListener('click', () => stopTimer(false));
