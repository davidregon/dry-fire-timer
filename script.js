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

// Variables de estado del Timer
let audioContext = null; // Se inicializará con el primer clic del usuario
let mainTimerId = null; // ID para setTimeout (delay/par time)
let animationFrameId = null; // ID para requestAnimationFrame (cronómetro)
let startTime = 0; // Tiempo de inicio del cronómetro
let currentRepetition = 0;
let totalRepetitions = 0;
let isRunning = false;
let isCountingTime = false;

// --- FUNCIONES DE AUDIO GARANTIZADAS ---

// Intenta inicializar o reanudar AudioContext al primer clic.
function startAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.error("Error al reanudar AudioContext:", e));
    }
    return audioContext;
}

// Función para generar un pitido (se asegura de usar el contexto)
function playBeep(frequency, duration) {
    const context = startAudioContext();
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

// 1. Pitido de INICIO (Frecuencia alta)
function startBeep() {
    playBeep(1500, 100); // Agudo, corto y penetrante
    statusDisplay.textContent = `¡FUEGO! COMPLETAR EJERCICIO`;
    
    // Iniciar el cronómetro
    startTimerDisplay();
}

// 2. Pitido de PAR TIME (Doble pitido grave)
function parTimeBeep() {
    stopTimerDisplay(); // Detener el cronómetro

    playBeep(400, 150);
    setTimeout(() => playBeep(400, 150), 200);

    statusDisplay.textContent = `TIEMPO PAR: ${parTimeInput.value}s`;
}

// --- FUNCIONES DE CRONÓMETRO DE ALTA PRECISIÓN ---

// Inicia el cronómetro visual
function startTimerDisplay() {
    startTime = Date.now();
    isCountingTime = true;
    updateTimerDisplay();
}

// Detiene el cronómetro visual
function stopTimerDisplay() {
    isCountingTime = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
}

// Función que actualiza el display del cronómetro (usando requestAnimationFrame para precisión)
function updateTimerDisplay() {
    if (!isCountingTime) return;

    const elapsedTime = Date.now() - startTime;
    
    // Formatear a S.cs (Segundos.Centésimas)
    const seconds = Math.floor(elapsedTime / 1000);
    const centiseconds = Math.floor((elapsedTime % 1000) / 10); // Centésimas de segundo

    const formattedTime = `${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    counterDisplay.textContent = formattedTime;

    // Llamar a sí misma en el siguiente ciclo de animación del navegador
    animationFrameId = requestAnimationFrame(updateTimerDisplay);
}

// --- LÓGICA PRINCIPAL DEL ENTRENAMIENTO ---

// Genera un retardo aleatorio (en milisegundos)
function getRandomDelay(min, max) {
    const minMs = parseFloat(min) * 1000;
    const maxMs = parseFloat(max) * 1000;
    const delay = Math.random() * (maxMs - minMs) + minMs;
    return delay;
}

// Ejecuta un ciclo de repetición (Set)
function runRepetition() {
    if (!isRunning) return;

    if (currentRepetition > totalRepetitions) {
        stopTimer(true); // Finalización exitosa
        return;
    }

    const min = minDelayInput.value;
    const max = maxDelayInput.value;
    const parTimeMs = parseFloat(parTimeInput.value) * 1000;

    // Validación
    if (parseFloat(min) >= parseFloat(max)) {
        statusDisplay.textContent = "ERROR: Retardo Min. debe ser menor que el Máx.";
        stopTimer(false);
        return;
    }
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
            
            currentRepetition++;
            
            if (currentRepetition <= totalRepetitions) {
                // Programa el descanso antes de la siguiente repetición
                const rest = parseFloat(restTimeInput.value) * 1000;
                statusDisplay.textContent = `DESCANSO. PRÓXIMO SET EN ${rest / 1000}s...`;
                
                mainTimerId = setTimeout(runRepetition, rest); 
            } else {
                runRepetition(); // Llama para finalizar la sesión
            }
        }, parTimeMs);
        
    }, randomDelay);
}

// Inicia el temporizador
function startTimer() {
    // Asegurarse de que el contexto de audio esté activo al primer clic
    startAudioContext();
    
    if (isRunning) return;

    // Obtener y validar valores
    totalRepetitions = parseInt(repetitionsInput.value);
    
    if (totalRepetitions < 1) {
        alert("El número de Repeticiones debe ser 1 o más.");
        return;
    }

    // Configuración inicial
    currentRepetition = 1;
    isRunning = true;
    
    // Control de interfaz
    toggleControls(true);

    // Inicio del ciclo
    runRepetition();
}

// Detiene el temporizador
function stopTimer(completed = false) {
    clearTimeout(mainTimerId);
    stopTimerDisplay();
    isRunning = false;
    
    // Control de interfaz
    toggleControls(false);

    // Actualiza el estado
    if (completed) {
        statusDisplay.textContent = 'ENTRENAMIENTO COMPLETADO';
        counterDisplay.textContent = 'FIN';
    } else {
        statusDisplay.textContent = `DETENIDO. ${currentRepetition > 1 ? currentRepetition - 1 : 0} SETS REALIZADOS`;
        counterDisplay.textContent = 'PAUSA';
    }
    currentSetDisplay.textContent = 'Set: 0/0';
}

// Función auxiliar para gestionar la interfaz
function toggleControls(disable) {
    startButton.disabled = disable;
    stopButton.disabled = !disable;
    minDelayInput.disabled = disable;
    maxDelayInput.disabled = disable;
    parTimeInput.disabled = disable;
    repetitionsInput.disabled = disable;
    restTimeInput.disabled = disable;
}

// Event Listeners
startButton.addEventListener('click', startTimer);
stopButton.addEventListener('click', () => stopTimer(false));
