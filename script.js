const reactionTimeInput = document.getElementById('reactionTime');
const repetitionsInput = document.getElementById('repetitions');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDisplay = document.getElementById('status');
const counterDisplay = document.getElementById('counter');

let audioContext;
let timerId = null;
let currentRepetition = 0;
let totalRepetitions = 0;
let isRunning = false;

// Función para crear y reproducir un pitido
function playBeep(frequency, duration) {
    if (!audioContext) {
        // Inicializa AudioContext la primera vez que se necesita
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Generador de onda (oscillator)
    const oscillator = audioContext.createOscillator();
    // Control de volumen (gain)
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine'; // Tipo de onda (senoidal)
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // Conecta el oscilador al control de volumen y este al destino (altavoces)
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Ajusta el volumen a 0.5
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

    // Inicia el sonido inmediatamente
    oscillator.start();

    // Detiene el sonido después de la duración especificada
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

// Función principal para una repetición
function runRepetition() {
    if (!isRunning) return;

    if (currentRepetition > totalRepetitions) {
        // Todas las repeticiones completadas
        stopTimer(true); // El 'true' indica una parada por finalización
        return;
    }

    const reactionTime = parseFloat(reactionTimeInput.value) * 1000; // a milisegundos
    
    statusDisplay.textContent = `Preparando Repetición ${currentRepetition}/${totalRepetitions}...`;
    counterDisplay.textContent = `Espera ${reactionTime / 1000}s...`;

    // Paso 1: Pitido de INICIO (después del tiempo de reacción aleatorio)
    timerId = setTimeout(() => {
        if (!isRunning) return;
        
        playBeep(880, 200); // Pitido de inicio (más agudo)
        statusDisplay.textContent = `¡FUEGO! Repetición ${currentRepetition}/${totalRepetitions}`;
        counterDisplay.textContent = '¡DISPARA!';
        
        // Paso 2: Pitido de FIN (después de 2 segundos, por ejemplo, para simular tiempo de ejercicio)
        // Podrías añadir otra configuración si quieres que este tiempo sea variable
        timerId = setTimeout(() => {
            if (!isRunning) return;
            
            playBeep(440, 400); // Pitido de fin (más grave y largo)
            
            // Incrementa la repetición y programa la siguiente
            currentRepetition++;
            
            if (currentRepetition <= totalRepetitions) {
                // Programa la siguiente repetición después de un breve descanso (ej. 1 segundo)
                statusDisplay.textContent = `Descanso...`;
                counterDisplay.textContent = 'Preparando siguiente...';
                timerId = setTimeout(runRepetition, 1000); 
            } else {
                runRepetition(); // Llama para finalizar si es la última
            }
        }, 2000); // Tiempo fijo de "ejercicio" después del pitido de inicio
        
    }, reactionTime);
}

// Inicia el temporizador
function startTimer() {
    if (isRunning) return;

    // Obtener y validar valores
    const rTime = parseFloat(reactionTimeInput.value);
    const reps = parseInt(repetitionsInput.value);

    if (rTime < 0.5 || reps < 1) {
        alert("Asegúrate de que el Tiempo de Reacción es >= 0.5s y las Repeticiones son >= 1.");
        return;
    }

    // Configuración inicial
    totalRepetitions = reps;
    currentRepetition = 1;
    isRunning = true;
    
    // Control de botones
    startButton.disabled = true;
    stopButton.disabled = false;
    reactionTimeInput.disabled = true;
    repetitionsInput.disabled = true;

    // Inicio del ciclo
    runRepetition();
}

// Detiene el temporizador
function stopTimer(completed = false) {
    clearTimeout(timerId);
    isRunning = false;
    
    // Control de botones
    startButton.disabled = false;
    stopButton.disabled = true;
    reactionTimeInput.disabled = false;
    repetitionsInput.disabled = false;

    // Actualiza el estado
    if (completed) {
        statusDisplay.textContent = '✅ ¡Entrenamiento Completado!';
        counterDisplay.textContent = `Total: ${totalRepetitions} repeticiones.`;
    } else {
        statusDisplay.textContent = `🔴 Detenido. Repetición ${currentRepetition} de ${totalRepetitions}.`;
        counterDisplay.textContent = 'Vuelve a iniciar.';
    }
}

// Event Listeners
startButton.addEventListener('click', startTimer);
stopButton.addEventListener('click', () => stopTimer(false));
