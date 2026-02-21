/* ════════════════════════════════════════
   poles.js — ESP32 Pole Monitor
   Edit this file to change pole/wire behaviour
   To connect real ESP32: see workerDetected() note at bottom
════════════════════════════════════════ */

// ── POLE DATA ─────────────────────────────
// Exposed as window.S_POLES so app.js can read it
window.S_POLES = [
  { id:'P-01', name:'North Junction A', status:'ok', pos:{x:75,  y:55},  real:false },
  { id:'P-02', name:'North Junction B', status:'ok', pos:{x:180, y:55},  real:false },
  { id:'P-03', name:'North Junction C', status:'ok', pos:{x:390, y:55},  real:false },
  { id:'P-04', name:'Central West',     status:'ok', pos:{x:75,  y:150}, real:false },
  { id:'P-05', name:'Central Main',     status:'ok', pos:{x:180, y:150}, real:true  }, // ← REAL ESP32
  { id:'P-06', name:'Central East',     status:'ok', pos:{x:390, y:150}, real:false },
  { id:'P-07', name:'South Junction A', status:'ok', pos:{x:75,  y:245}, real:false },
  { id:'P-08', name:'South Junction B', status:'ok', pos:{x:180, y:245}, real:false },
  { id:'P-09', name:'East Main',        status:'ok', pos:{x:510, y:150}, real:false },
];

// Wire connections: pairs of pole indexes
const WIRE_PAIRS = [
  [0,1],[1,2],          // Top horizontal
  [3,4],[4,5],          // Middle horizontal
  [6,7],                // Bottom horizontal
  [8,5],                // Right side
  [0,3],[3,6],          // Left vertical
  [1,4],[4,7],          // Center vertical
  [2,5],                // Right vertical
];

// ── RENDER MAP ────────────────────────────
function renderMap() {
  const wireG = document.getElementById('wireG');
  const poleG = document.getElementById('poleG');
  if (!wireG || !poleG) return;

  // Draw wire lines
  wireG.innerHTML = WIRE_PAIRS.map(([a, b]) => {
    const pa = window.S_POLES[a], pb = window.S_POLES[b];
    const isBroken = pa.status === 'broken' || pb.status === 'broken';
    return `<line class="wire ${isBroken ? 'broken' : 'ok'}"
      x1="${pa.pos.x}" y1="${pa.pos.y}"
      x2="${pb.pos.x}" y2="${pb.pos.y}"/>`;
  }).join('');

  // Draw pole circles
  poleG.innerHTML = window.S_POLES.map((p, i) => `
    <g onclick="togglePole(${i})" style="cursor:pointer">
      ${p.real ? `<circle class="p-real-ring" cx="${p.pos.x}" cy="${p.pos.y}" r="21"/>` : ''}
      <circle class="p-circle ${p.status}" cx="${p.pos.x}" cy="${p.pos.y}"/>
      <text class="p-label ${p.status}" x="${p.pos.x}" y="${p.pos.y}">${p.id.replace('P-', '')}</text>
      ${p.real ? `<circle cx="${p.pos.x+16}" cy="${p.pos.y-16}" r="5" fill="var(--blue)" stroke="var(--sidebar)" stroke-width="2"/>` : ''}
    </g>`).join('');

  // Update map badge
  const broken = window.S_POLES.filter(p => p.status === 'broken').length;
  const badge = document.getElementById('mapBadge');
  if (badge) { badge.textContent = broken > 0 ? `${broken} Broken` : 'All Online'; badge.className = broken > 0 ? 'badge badge-danger' : 'badge badge-teal'; }

  // Update pole list panel
  const listEl = document.getElementById('poleListEl');
  if (listEl) {
    listEl.innerHTML = window.S_POLES.map(p => `
      <div class="pole-row ${p.status === 'broken' ? 'broken' : ''} ${p.real ? 'real' : ''}">
        <span class="pole-id">${p.id}</span>
        <span class="pole-name">${p.name}${p.real ? ' 📡' : ''}</span>
        <span class="pole-st ${p.status}">${p.status === 'ok' ? 'Online' : 'BROKEN'}</span>
      </div>`).join('');
  }
}

// ── CLICK TO TOGGLE (demo only) ───────────
function togglePole(i) {
  const p = window.S_POLES[i];
  if (p.status === 'ok') {
    p.status = 'broken';
    log('ERROR', `Wire break: ${p.id} — ${p.name}`);
    notify('danger', `⚡ ${p.id} Wire Break`, `${p.name} disconnected. Maintenance needed.`);
    showPoleAlert(p);
    S.violations++;
  } else {
    p.status = 'ok';
    log('OK', `${p.id} restored to operational`);
  }
  renderMap();
  updateOvStats();
  updateNavBadges();
}

function showPoleAlert(p) {
  document.getElementById('poleAlertTitle').textContent = `Wire Breakdown — ${p.id}`;
  document.getElementById('poleAlertDesc').textContent  = `${p.name} wire disconnected${p.real ? ' via real ESP32 sensor' : ''}.`;
  document.getElementById('poleAlertBar').classList.add('show');
}

// ── SIMULATE BREAKDOWN (demo button) ──────
function simBreak() {
  const ok = window.S_POLES.filter(p => p.status === 'ok');
  if (!ok.length) return;
  const p = ok[Math.floor(Math.random() * ok.length)];
  p.status = 'broken';
  esp32Log(`ERR: GPIO break on ${p.id} — voltage=0V`, 't-err');
  log('ERROR', `ESP32: Wire break on ${p.id}`);
  notify('danger', `⚡ ${p.id} Wire Break`, `${p.name} disconnected (0V).`);
  showPoleAlert(p);
  S.violations++;
  renderMap();
  updateOvStats();
  updateNavBadges();
}

function resetPoles() {
  window.S_POLES.forEach(p => p.status = 'ok');
  const bar = document.getElementById('poleAlertBar');
  if (bar) bar.classList.remove('show');
  log('OK', 'All poles reset to operational');
  renderMap();
  updateOvStats();
  updateNavBadges();
}

// ── ESP32 TERMINAL FEED ───────────────────
function esp32Log(msg, cls = 't-info') {
  const el = document.getElementById('esp32T');
  if (!el) return;
  const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
  const line = document.createElement('div');
  line.className = 't-line';
  line.innerHTML = `<span class="t-ts">[${ts}]</span><span class="${cls}">${msg}</span>`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

// Boot messages
['SYS: ESP32 connected — COM3', 'SYS: 9 poles registered', 'SYS: GPIO polling at 500ms interval'].forEach(m => esp32Log(m));

// Simulated heartbeat packets every 4s
setInterval(() => {
  const ok = window.S_POLES.filter(p => p.status === 'ok');
  if (ok.length) {
    const p = ok[Math.floor(Math.random() * ok.length)];
    esp32Log(`PKT: ${p.id} — ${(220 + Math.random() * 5 - 2).toFixed(1)}V OK`, 't-ok');
  }
}, 4000);

// ════════════════════════════════════════
// REAL ESP32 INTEGRATION:
// When your Python server.py receives data over serial,
// it emits a WebSocket event. Connect it here:
//
//   const socket = io('http://localhost:5000');
//
//   socket.on('pole_status', (data) => {
//     // data = { pole: 'P-05', status: 'broken', voltage: 0 }
//     const p = window.S_POLES.find(x => x.id === data.pole);
//     if (!p) return;
//     const wasBroken = p.status === 'broken';
//     p.status = data.status;
//     if (data.status === 'broken' && !wasBroken) {
//       esp32Log(`[REAL] ERR: ${data.pole} voltage=${data.voltage}V`, 't-err');
//       log('ERROR', `[REAL ESP32] Wire break on ${data.pole}`);
//       notify('danger', `⚡ REAL Break — ${data.pole}`, `ESP32 reports 0V on ${data.pole}`);
//       showPoleAlert(p);
//       S.violations++;
//     }
//     renderMap(); updateOvStats(); updateNavBadges();
//   });
//
//   socket.on('esp32_log', (data) => esp32Log(`[REAL] ${data.msg}`));
// ════════════════════════════════════════
