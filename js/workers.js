/* ════════════════════════════════════════
   workers.js — CNN Face Recognition & Timer
   
   TIMER LOGIC:
   - Timer starts the FIRST time a person is detected
   - Timer = (current time) - (first detection time)
   - It is a wall-clock timer: it includes time even when
     the person is NOT in front of the camera
   - Because the goal is: how long has this person been
     on-site since they arrived? Not how long they stood
     in front of the camera.
   
   HOW TO CONNECT YOUR CNN MODEL:
   - Your Python backend detects a face
   - It sends: socket.emit('face_detection', {id:'W-001', confidence:98.5})
   - This file calls: workerDetected('W-001', 98.5)
   - That's it — timers handle themselves automatically
════════════════════════════════════════ */

// ── WORKER DATA ───────────────────────────
// Names updated to match labels.json: Aarush, Aditya, Divine, Mukti
window.S_WORKERS = [
  {
    name:   'Aarush',
    id:     'W-001',
    emoji:  '👷',
    color:  '#4f8ef7',
    overtimeLimit: 9 * 3600,

    // Timer fields — DO NOT edit these manually
    accumulatedSeconds: 0,    // total seconds confirmed on-site (past sessions)
    sessionStart:       null, // timestamp when current in-frame session began
    lastDetectedAt:     null, // timestamp of most recent detection
    isCurrentlyVisible: false,
    overtimeAlertFired: false,
    everSeen:           false,
  },
  {
    name:   'Aditya',
    id:     'W-002',
    emoji:  '🧑',
    color:  '#26d0b2',
    overtimeLimit: 9 * 3600,
    accumulatedSeconds: 0,
    sessionStart:       null,
    lastDetectedAt:     null,
    isCurrentlyVisible: false,
    overtimeAlertFired: false,
    everSeen:           false,
  },
  {
    name:   'Divine',
    id:     'W-003',
    emoji:  '🧑',
    color:  '#ff9548',
    overtimeLimit: 9 * 3600,
    accumulatedSeconds: 0,
    sessionStart:       null,
    lastDetectedAt:     null,
    isCurrentlyVisible: false,
    overtimeAlertFired: false,
    everSeen:           false,
  },
  {
    name:   'Mukti',
    id:     'W-004',
    emoji:  '👩‍🔧',
    color:  '#2ed573',
    overtimeLimit: 9 * 3600,
    accumulatedSeconds: 0,
    sessionStart:       null,
    lastDetectedAt:     null,
    isCurrentlyVisible: false,
    overtimeAlertFired: false,
    everSeen:           false,
  },
];

// ── LABEL → WORKER ID MAP ─────────────────
// Maps CNN output label (from labels.json) to worker ID
const LABEL_TO_ID = {
  'Aarush': 'W-001',
  'Aditya': 'W-002',
  'Divine': 'W-003',
  'Mukti':  'W-004',
};

// Tracks how many unique workers have been seen today
let totalDetectedToday = 0;

// ── CORE TIMER FUNCTIONS ──────────────────

// Returns total seconds ON-SITE for a worker.
// = accumulated past sessions + current session (if in frame)
// Timer PAUSES when person leaves frame, RESUMES when re-detected.
function getSecondsOnSite(w) {
  if (!w.everSeen) return 0;
  const currentSession = w.isCurrentlyVisible && w.sessionStart
    ? Math.floor((Date.now() - w.sessionStart) / 1000)
    : 0;
  return w.accumulatedSeconds + currentSession;
}

// ── CALLED BY CNN MODEL ───────────────────
// Call this every time the CNN detects a face.
// id: the worker's id string e.g. 'W-001'
// confidence: float 0-100 (optional, just for display)
function workerDetected(id, confidence = 97.0) {
  const w = window.S_WORKERS.find(x => x.id === id);
  if (!w) { console.warn(`Unknown worker id: ${id}`); return; }

  const now = Date.now();

  if (!w.everSeen) {
    // First time ever seeing this person today — start first session
    w.everSeen     = true;
    w.sessionStart = now;
    w.lastDetectedAt = now;
    w.isCurrentlyVisible = true;
    totalDetectedToday++;
    document.getElementById('cnnDetected').textContent = totalDetectedToday;
    log('INFO', `CNN: First detection → ${w.name} (${w.id}) — timer started`);
  } else if (!w.isCurrentlyVisible) {
    // Person was away — resume timer by starting a new session
    w.sessionStart = now;
    w.isCurrentlyVisible = true;
    log('INFO', `CNN: ${w.name} re-detected — resuming timer (${fmtTime(getSecondsOnSite(w))} so far)`);
  }

  w.lastDetectedAt = now;

  // Update camera overlay
  const cm = document.getElementById('camMatch');
  const cc = document.getElementById('camConf');
  const cf = document.getElementById('cnnConf');
  if (cm) { cm.textContent = w.name; cm.classList.add('show'); setTimeout(() => cm.classList.remove('show'), 2500); }
  if (cc) cc.textContent = `conf: ${confidence.toFixed(1)}%`;
  if (cf) cf.textContent = `${confidence.toFixed(1)}%`;

  checkOvertime(w);
  renderWorkers();
}

// ── OVERTIME CHECK ────────────────────────
function checkOvertime(w) {
  const sec = getSecondsOnSite(w);
  if (!w.overtimeAlertFired && sec >= w.overtimeLimit) {
    w.overtimeAlertFired = true;
    log('ERROR', `OVERTIME: ${w.name} (${w.id}) — ${fmtTime(sec)} on-site`);
    notify('warn', `⏱ Overtime — ${w.name}`, `${w.name} has been on-site for ${fmtTimeShort(sec)}.`);

    const bar   = document.getElementById('faceAlertBar');
    const title = document.getElementById('faceAlertTitle');
    const desc  = document.getElementById('faceAlertDesc');
    if (bar && title && desc) {
      title.textContent = `Overtime — ${w.name}`;
      desc.textContent  = `CNN confirms ${w.id} on-site for ${fmtTimeShort(sec)} — exceeds 9h limit.`;
      bar.classList.add('show');
    }
    S.violations++;
    updateOvStats();
    updateNavBadges();
  }
}

// ── MARK AS GONE FROM FRAME ───────────────
function workerLost(id) {
  const w = window.S_WORKERS.find(x => x.id === id);
  if (!w || !w.isCurrentlyVisible) return;

  // Save this session's seconds before pausing the timer
  if (w.sessionStart) {
    w.accumulatedSeconds += Math.floor((Date.now() - w.sessionStart) / 1000);
    w.sessionStart = null;
  }

  w.isCurrentlyVisible = false;
  log('INFO', `CNN: ${w.name} left frame — timer paused at ${fmtTimeShort(w.accumulatedSeconds)}`);
}

// ── RENDER WORKER TABLE ───────────────────
function renderWorkers() {
  const tbody = document.getElementById('workerTbody');
  if (!tbody) return;

  let otCount = 0;

  tbody.innerHTML = window.S_WORKERS.map(w => {
    const sec    = getSecondsOnSite(w);
    const pct    = Math.min((sec / w.overtimeLimit) * 100, 100);
    const isOver = sec >= w.overtimeLimit;
    const isNear = !isOver && pct >= 88;
    if (isOver) otCount++;

    const tagClass = isOver ? 'over'  : isNear ? 'near'  : 'ok';
    const tagText  = isOver ? 'OVERTIME' : isNear ? 'Near Limit' : w.isCurrentlyVisible ? 'On-Site' : w.everSeen ? 'Away' : 'Not Detected';
    const barColor = isOver ? 'var(--red)' : isNear ? 'var(--orange)' : 'var(--teal)';
    const timeColor = isOver ? 'var(--red)' : isNear ? 'var(--orange)' : w.isCurrentlyVisible ? 'var(--teal)' : 'var(--text2)';

    const firstSeenStr = w.everSeen ? 'Detected' : '—';
    const timeDisplay = w.everSeen ? fmtTime(sec) : '—h ——m ——s';
    const pctDisplay  = w.everSeen ? `${pct.toFixed(1)}% of 9h limit` : 'Not yet detected today';

    return `<tr class="${isOver ? 'overtime' : ''}">
      <td>
        <div class="wname">
          <div class="wa" style="border:1.5px solid ${w.color}33;background:${w.color}15;">${w.emoji}</div>
          <div>
            <div class="wn">${w.name}</div>
            <div class="wi">${w.id} · First seen: ${firstSeenStr}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:${timeColor};letter-spacing:-0.3px;">
          ${timeDisplay}
        </div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:3px;font-size:10px;color:var(--text3);">
          <div style="width:6px;height:6px;border-radius:50%;background:${w.isCurrentlyVisible ? 'var(--green)' : 'var(--text3)'};${w.isCurrentlyVisible ? 'box-shadow:0 0 5px var(--green)' : ''}"></div>
          ${w.isCurrentlyVisible ? 'In frame' : w.everSeen ? 'Out of frame' : 'Not yet seen'}
        </div>
      </td>
      <td>
        <div class="time-bar-bg">
          <div class="time-bar-fill" style="width:${pct}%;background:${barColor};${isOver ? 'box-shadow:0 0 6px var(--red)' : ''}"></div>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px;">${pctDisplay}</div>
      </td>
      <td><span class="ot-tag ${tagClass}">${tagText}</span></td>
    </tr>`;
  }).join('');

  const wb = document.getElementById('workerBadge');
  if (wb) { wb.textContent = otCount > 0 ? `${otCount} Overtime` : 'No Overtime'; wb.className = otCount > 0 ? 'badge badge-danger' : 'badge badge-ok'; }
  const otEl = document.getElementById('cnnOT');
  if (otEl) otEl.textContent = otCount;
}

// ── MASTER TICKER ─────────────────────────
setInterval(() => {
  const now = Date.now();
  window.S_WORKERS.forEach(w => {
    if (w.isCurrentlyVisible && w.lastDetectedAt && (now - w.lastDetectedAt) > 10000) {
      workerLost(w.id);
    }
    if (w.everSeen) checkOvertime(w);
  });
  renderWorkers();
  updateOvStats();
  updateNavBadges();
}, 1000);

// ── TIME FORMAT HELPERS ───────────────────
function fmtTime(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
function fmtTimeShort(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// ── SIMULATE OVERTIME (demo button) ───────
function simOvertime() {
  const w = window.S_WORKERS.find(x => getSecondsOnSite(x) < x.overtimeLimit) || window.S_WORKERS[0];
  w.everSeen           = true;
  w.accumulatedSeconds = 9 * 3600 + 1800;
  w.sessionStart       = null;
  w.isCurrentlyVisible = false;
  w.lastDetectedAt     = Date.now();
  checkOvertime(w);
  renderWorkers();
}

// ── RESET WORKERS ─────────────────────────
function resetWorkers() {
  window.S_WORKERS.forEach(w => {
    w.accumulatedSeconds = 0;
    w.sessionStart       = null;
    w.lastDetectedAt     = null;
    w.isCurrentlyVisible = false;
    w.overtimeAlertFired = false;
    w.everSeen           = false;
  });
  totalDetectedToday = 0;
  const cnnDet = document.getElementById('cnnDetected');
  if (cnnDet) cnnDet.textContent = '0';
  const bar = document.getElementById('faceAlertBar');
  if (bar) bar.classList.remove('show');
  log('OK', 'Worker timers reset');
  renderWorkers();
}

// ── REAL CNN SOCKET CONNECTION ────────────
// socket is created globally in app.js — used here directly

// Receives face detection events from Python
socket.on('face_detection', (data) => {
  // data = { label: 'Aarush', confidence: 98.3 }
  const workerId = LABEL_TO_ID[data.label];
  if (!workerId) {
    console.warn(`No worker mapped for label: ${data.label}`);
    return;
  }
  workerDetected(workerId, data.confidence * 100); // server sends 0-1, we show 0-100
});

// Receives face lost events from Python
socket.on('face_lost', (data) => {
  // data = { label: 'Aarush' }
  const workerId = LABEL_TO_ID[data.label];
  if (workerId) workerLost(workerId);
});

// ── INIT ──────────────────────────────────
window.addEventListener('load', () => {
  renderWorkers();
  log('INFO', 'CNN ResNet-50 face recognition model loaded');
  log('INFO', '4 worker profiles registered: Aarush, Aditya, Divine, Mukti');
});
