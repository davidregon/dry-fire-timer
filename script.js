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

// Variables de estado del Timer
let audioContext;
let mainTimerId = null;
let currentRepetition = 0;
let totalRepetitions = 0;
let isRunning = false;
let restTimerId = null;

// --- Funciones de Audio ---

// Inicializa o reanuda el AudioContext (necesario por las restricciones del navegador)
function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Reanudar si está suspendido (necesario en algunos navegadores después del primer clic)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

// Función para generar un pitido
function playBeep(frequency, duration) {
    const context = getAudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'square'; // Onda cuadrada para un sonido más "digital" y fuerte
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    
    gainNode.gain.setValueAtTime(0.5, context.currentTime); // Volumen
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000);
}

// --- Lógica del Temporizador ---

// 1. Pitido de INICIO (Frecuencia alta)
function startBeep() {
    playBeep(1200, 100); // Pitido de inicio, agudo y corto
    statusDisplay.textContent = `🚨 ¡FUEGO! (Set ${currentRepetition}/${totalRepetitions})`;
    counterDisplay.textContent = '¡DISPARA!';
}

// 2. Pitido de PAR TIME (Frecuencia baja y doble)
function parTimeBeep() {
    // Doble pitido más grave para indicar el fin del tiempo límite (Par Time)
    playBeep(400, 150);
    setTimeout(() => playBeep(400, 150), 200);

    statusDisplay.textContent = `✅ Par Time Finalizado.`;
    counterDisplay.textContent = 'RECARGANDO...';
}

// Genera un retardo aleatorio entre min y max (en milisegundos)
function getRandomDelay(min, max) {
    // Fórmula: Math.random() * (max - min) + min
    const delay = Math.random() * (max - min) + min;
    return delay * 1000; // Convertir a milisegundos
}

// Ejecuta un ciclo de repetición (Set)
function runRepetition() {
    if (!isRunning) return;

    if (currentRepetition > totalRepetitions) {
        stopTimer(true); // Finalización exitosa
        return;
    }

    const min = parseFloat(minDelayInput.value);
    const max = parseFloat(maxDelayInput.value);
    const parTime = parseFloat(parTimeInput.value) * 1000;

    // Validación de retardo aleatorio
    if (min >= max) {
        statusDisplay.textContent = "❌ Error: Retardo Mínimo debe ser menor que el Máximo.";
        stopTimer(false);
        return;
    }

    const randomDelay = getRandomDelay(min, max);
    
    statusDisplay.textContent = `Esperando señal... (Set ${currentRepetition}/${totalRepetitions})`;
    counterDisplay.textContent = `Retardo: ${randomDelay.toFixed(0)}ms`;

    // Paso 1: Espera el Retardo Aleatorio, luego suena el pitido de INICIO
    mainTimerId = setTimeout(() => {
        if (!isRunning) return;
        
        startBeep();
        
        // Paso 2: Después del pitido de INICIO, espera el Tiempo Par, luego suena el pitido de FIN
        mainTimerId = setTimeout(() => {
            if (!isRunning) return;

            parTimeBeep();
            
            currentRepetition++;
            
            if (currentRepetition <= totalRepetitions) {
                // Programa el descanso antes de la siguiente repetición
                const rest = parseFloat(restTimeInput.value) * 1000;
                statusDisplay.textContent = `⏳ Descanso (${rest / 1000}s)...`;
                
                restTimerId = setTimeout(runRepetition, rest); 
            } else {
                runRepetition(); // Llama para finalizar la sesión
            }
        }, parTime);
        
    }, randomDelay);
}

// Inicia el temporizador
function startTimer() {
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
    
    // Control de interfaz: deshabilitar controles y habilitar stop
    toggleControls(true);

    // Inicio del ciclo
    runRepetition();
}

// Detiene el temporizador
function stopTimer(completed = false) {
    clearTimeout(mainTimerId);
    clearTimeout(restTimerId);
    isRunning = false;
    
    // Control de interfaz: habilitar controles y deshabilitar stop
    toggleControls(false);

    // Actualiza el estado
    if (completed) {
        statusDisplay.textContent = '🎉 ¡Entrenamiento Completo! ¡Buen trabajo!';
        counterDisplay.textContent = `Sesiones terminadas: ${totalRepetitions}`;
    } else {
        statusDisplay.textContent = `🛑 Detenido por el usuario.`;
        counterDisplay.textContent = `Sets hechos: ${currentRepetition > 1 ? currentRepetition - 1 : 0}`;
    }
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
