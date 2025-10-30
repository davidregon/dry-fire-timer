<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Temporizador Dry-Fire — REGON Tactical (versión ES)</title>
<style>
  :root{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial; color:#111}
  body{margin:0;background:#f6f6f8;padding:24px;line-height:1.45}
  .container{max-width:980px;margin:0 auto;background:#fff;padding:22px;border-radius:8px;box-shadow:0 6px 18px rgba(10,10,10,.06)}
  h1{margin:0 0 8px;font-size:22px}
  .top{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
  label{display:block;font-size:13px;margin-bottom:6px;color:#333}
  select,input[type=number],input[type=range],input[type=text]{padding:8px;border:1px solid #ddd;border-radius:6px}
  .col{flex:1 1 220px;min-width:220px}
  .controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  button{padding:10px 14px;border-radius:6px;border:0;background:#111;color:#fff;cursor:pointer}
  button.secondary{background:#eee;color:#111;border:1px solid #ddd}
  .status{margin-top:14px;padding:12px;background:#fafafa;border-radius:6px;border:1px solid #eee}
  .big{font-size:28px;font-weight:700}
  .small{font-size:13px;color:#666}
  .warn{background:#fff4e6;border:1px solid #ffe2b8;padding:10px;border-radius:6px;margin-top:12px}
  footer{margin-top:18px;font-size:13px;color:#666}
  .inline{display:inline-flex;gap:8px;align-items:center}
</style>
</head>
<body>
  <div class="container">
    <h1>Temporizador Dry-Fire — Práctica en seco (ES)</h1>
    <div class="small">Inspirado en recursos de entrenamiento táctico. Asegúrate de que el arma está descargada antes de usarlo. Más info: Pistol Wizard (referencia).</div>
    <div style="height:12px"></div>

    <div class="top">
      <div class="col">
        <label>Drill (ejercicio)</label>
        <select id="drill">
          <option>Freestyle</option>
          <option>Presionar disparador</option>
          <option>Draw → Paso 1</option>
          <option>Draw (1 → 2)</option>
          <option>Draw (2 → 3)</option>
          <option>Draw (completo)</option>
          <option>Transición de objetivos</option>
          <option>Recarga</option>
        </select>
      </div>

      <div class="col">
        <label>Dificultad</label>
        <select id="difficulty">
          <option>Principiante</option>
          <option>Intermedio</option>
          <option>Avanzado</option>
          <option>Máster</option>
        </select>
      </div>

      <div class="col">
        <label>Par time (segundos) — tiempo objetivo</label>
        <input id="parTime" type="number" min="0" max="5" step="0.05" value="0.6">
      </div>

      <div class="col">
        <label>Delay de inicio (segundos)</label>
        <input id="delay" type="number" min="0" max="30" step="0.5" value="3">
      </div>
    </div>

    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <label class="inline"><input id="randomize" type="checkbox"> Aleatorizar par time</label>
      <label style="margin-left:6px">Rango +/- <input id="randRange" type="number" min="0" max="1" step="0.01" value="0.05" style="width:80px"> s</label>

      <label style="margin-left:16px" class="inline">Sets de 10 (reps por set)</label>
      <label style="margin-left:6px">Sets: <input id="sets" type="number" min="1" max="20" step="1" value="1" style="width:80px"></label>
    </div>

    <div class="controls">
      <button id="startBtn">Start</button>
      <button id="pauseBtn" class="secondary" disabled>Pause</button>
      <button id="resumeBtn" class="secondary" disabled>Resume</button>
      <button id="stopBtn" class="secondary" disabled>Stop</button>

      <div style="margin-left:auto" class="small">Beep: reproducido por WebAudio (no requiere archivos).</div>
    </div>

    <div class="status" id="status">
      <div><strong>Estado:</strong> <span id="state">Detenido</span></div>
      <div style="margin-top:8px">
        <span class="big" id="repDisplay">Set 0 / 0</span>
        <div class="small">Repetición actual / total (cada set = 10 reps)</div>
      </div>
    </div>

    <div class="warn">
      <strong>SEGURIDAD:</strong> Antes de practicar, comprueba manualmente que el arma está descargada. Practica con un respaldo seguro y en espacio adecuado. El autor no se hace responsable por uso indebido.
    </div>

    <section style="margin-top:12px">
      <h3>Instrucciones rápidas</h3>
      <ol>
        <li>Comprueba que el arma está descargada y el área es segura.</li>
        <li>Selecciona el drill y la dificultad.</li>
        <li>Pulsa <strong>Start</strong>. El temporizador hará un delay de inicio, luego reproducirá dos pitidos por repetición: empieza en el primer pitido y finaliza antes del segundo.</li>
        <li>Cada set tiene 10 repeticiones. Ajusta el par time según tu rendimiento (si pasas 10/10 reduce 0.1s; si fallas sube 0.1s).</li>
      </ol>
      <small class="small">Esta página está adaptada para entrenamiento seco y está basada en prácticas comunes de entrenamiento táctico. Para contenido original en inglés, ver Pistol Wizard.  [oai_citation:1‡Pistol Wizard](https://pistolwizard.com/dry-fire-timer)</small>
    </section>

    <footer>
      Código entregado por REGON Tactical — versión adaptada en español.
    </footer>
  </div>

<script>
/* Temporizador dry-fire: par de pitidos por repetición.
   Cada repetición: beep1 -> (parTime) -> beep2
   Repeticiones por set: 10. Repetir por N sets.
   Soporta pause/resume/stop y aleatoriedad pequeña en parTime.
*/

const ctx = new (window.AudioContext || window.webkitAudioContext)();

function beep(timeFromNow = 0, duration = 0.30, freq = 1000, gainVal = 0.5) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.value = 0;
  o.connect(g); g.connect(ctx.destination);
  const now = ctx.currentTime + timeFromNow;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gainVal, now + 0.005);
  g.gain.linearRampToValueAtTime(0, now + duration);
  o.start(now);
  o.stop(now + duration + 0.01);
}

// UI elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const stateEl = document.getElementById('state');
const repDisplay = document.getElementById('repDisplay');

let schedule = []; // array of timeouts IDs
let running = false;
let paused = false;
let pauseAt = 0;
let t0 = 0;
let nextEventTime = 0;
let currentSet = 0;
let currentRep = 0;
let totalRepsPerSet = 10;
let totalSets = 1;

function getSettings(){
  return {
    parTime: parseFloat(document.getElementById('parTime').value),
    delay: parseFloat(document.getElementById('delay').value),
    randomize: document.getElementById('randomize').checked,
    randRange: parseFloat(document.getElementById('randRange').value),
    sets: parseInt(document.getElementById('sets').value,10)
  };
}

function updateRepDisplay(){
  repDisplay.textContent = `Set ${currentSet} / ${totalSets} — Rep ${currentRep} / ${totalRepsPerSet}`;
}

function clearSchedule(){
  schedule.forEach(id=>clearTimeout(id));
  schedule = [];
}

function startTimer(){
  if(running) return;
  // resume audio context if needed
  if(ctx.state === 'suspended') ctx.resume();

  const s = getSettings();
  totalSets = s.sets;
  currentSet = 1;
  currentRep = 0;
  updateRepDisplay();

  running = true;
  paused = false;
  stateEl.textContent = 'Contando...';
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  resumeBtn.disabled = true;
  stopBtn.disabled = false;

  // schedule after delay
  const now = Date.now();
  t0 = now + Math.max(0, s.delay*1000);
  scheduleBeepSequence(t0, s);
}

function scheduleBeepSequence(startTimeMs, settings){
  // We'll schedule all beep pairs for all sets (simple approach).
  // For each rep: beep1 at t, beep2 at t + parTime
  // After beep2, small gap 0.25s then next rep starts (so reps don't overlap when parTime small)
  const repGapAfterSecond = 250; // ms
  let t = startTimeMs;
  const baseDelay = t - Date.now();

  const totalReps = totalSets * totalRepsPerSet;
  let repIndex = 0;

  for(let set=1; set<=totalSets; set++){
    for(let rep=1; rep<=totalRepsPerSet; rep++){
      repIndex++;
      // calculate parTime with optional randomization
      let par = settings.parTime;
      if(settings.randomize && settings.randRange>0){
        const delta = (Math.random()*2 -1) * settings.randRange;
        par = Math.max(0, par + delta);
      }
      const beep1Time = t;
      const beep2Time = t + (par*1000);
      // schedule beep1
      schedule.push(setTimeout(()=>{
        // update counters
        currentSet = set;
        currentRep = rep;
        updateRepDisplay();
        beep(0, 0.30, 1000, 0.6);
      }, Math.max(0, beep1Time - Date.now())));
      // schedule beep2
      schedule.push(setTimeout(()=>{
        beep(0, 0.30, 1200, 0.55);
        // if last rep, finish
        if(set===totalSets && rep===totalRepsPerSet){
          finishRun();
        }
      }, Math.max(0, beep2Time - Date.now())));
      // advance t to after beep2 + gap
      t = beep2Time + repGapAfterSecond;
    }
  }
}

function finishRun(){
  running = false;
  paused = false;
  stateEl.textContent = 'Completado';
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  stopBtn.disabled = true;
}

function pauseTimer(){
  if(!running || paused) return;
  paused = true;
  stateEl.textContent = 'Pausado';
  pauseBtn.disabled = true;
  resumeBtn.disabled = false;
  // compute remaining time to next scheduled timeouts by clearing them and storing remaining times
  // For simplicity: we clear and will not resume precise scheduling. Instead we enable resume to restart remaining reps.
  // We'll compute how many reps left by reading currentSet/currentRep.
  clearSchedule();
}

function resumeTimer(){
  if(!paused) return;
  paused=false;
  stateEl.textContent = 'Contando...';
  pauseBtn.disabled = false;
  resumeBtn.disabled = true;
  // Determine how many reps remain and schedule them starting now + 200ms
  const s = getSettings();
  const startNow = Date.now() + 200;
  // calculate next set/rep
  let set = currentSet;
  let rep = currentRep + 1;
  if(rep > totalRepsPerSet){
    set++;
    rep = 1;
  }
  // rebuild schedule from (set,rep) onward
  const remainingSets = [];
  for(let ss=set; ss<=s.sets; ss++){
    const startRep = (ss===set) ? rep : 1;
    remainingSets.push({set:ss, startRep});
  }
  // schedule remaining
  const repGapAfterSecond = 250;
  let t = startNow;
  remainingSets.forEach(group=>{
    for(let r=group.startRep; r<=totalRepsPerSet; r++){
      let par = s.parTime;
      if(s.randomize && s.randRange>0){
        const delta = (Math.random()*2 -1) * s.randRange;
        par = Math.max(0, par + delta);
      }
      const beep1Time = t;
      const beep2Time = t + (par*1000);
      schedule.push(setTimeout(()=>{
        currentSet = group.set;
        currentRep = r;
        updateRepDisplay();
        beep(0,0.30,1000,0.6);
      }, Math.max(0, beep1Time - Date.now())));
      schedule.push(setTimeout(()=>{
        beep(0,0.30,1200,0.55);
        if(group.set === s.sets && r === totalRepsPerSet) finishRun();
      }, Math.max(0, beep2Time - Date.now())));
      t = beep2Time + repGapAfterSecond;
    }
  });
}

function stopTimer(){
  clearSchedule();
  running = false;
  paused = false;
  currentSet = 0;
  currentRep = 0;
  updateRepDisplay();
  stateEl.textContent = 'Detenido';
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  stopBtn.disabled = true;
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resumeBtn.addEventListener('click', resumeTimer);
stopBtn.addEventListener('click', stopTimer);

updateRepDisplay();
</script>
</body>
</html>
