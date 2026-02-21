/* ════════════════════════════════════════
   temperature.js — Temperature Monitor
   Edit this file to change temp thresholds,
   zones, chart behaviour
════════════════════════════════════════ */

// ── TEMP CONFIG ───────────────────────────
const TEMP_WARN    = 27;   // °C — show warning
const TEMP_DANGER  = 35;   // °C — trigger alert

// ── TEMP STATE ────────────────────────────
window.S_TEMP = {
  current:  0,
  max:      0,
  min:      99,
  history:  [],
  zones: [
    { name: 'Zone A — Warehouse', temp: 0, label: 'Primary Storage (DHT11 Live)' },
    { name: 'Zone B — Cold Room',  temp: 12, label: 'Refrigerated Unit' },
    { name: 'Zone C — Loading',    temp: 0, label: 'Dock Area' },
  ],
  alertFired: false,
};

// ── CHART ─────────────────────────────────
let chartCtx = null;

function initChart() {
  const canvas = document.getElementById('tempChart');
  if (!canvas) return;
  canvas.width  = canvas.parentElement.offsetWidth;
  canvas.height = 70;
  chartCtx = canvas.getContext('2d');
  drawChart();
}

function drawChart() {
  if (!chartCtx) return;
  const canvas = document.getElementById('tempChart');
  const w = canvas.width, h = canvas.height;
  const data = window.S_TEMP.history.slice(-50);
  chartCtx.clearRect(0, 0, w, h);

  // Threshold line
  const ty = h - (TEMP_DANGER / 100) * h;
  chartCtx.setLineDash([4, 4]);
  chartCtx.beginPath(); chartCtx.moveTo(0, ty); chartCtx.lineTo(w, ty);
  chartCtx.strokeStyle = 'rgba(255,77,109,0.3)'; chartCtx.lineWidth = 1; chartCtx.stroke();
  chartCtx.setLineDash([]);

  // Gradient fill
  const grad = chartCtx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(38,208,178,0.2)');
  grad.addColorStop(1, 'rgba(38,208,178,0)');
  chartCtx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w, y = h - (v / 100) * h;
    i === 0 ? chartCtx.moveTo(x, y) : chartCtx.lineTo(x, y);
  });
  chartCtx.lineTo(w, h); chartCtx.lineTo(0, h); chartCtx.closePath();
  chartCtx.fillStyle = grad; chartCtx.fill();

  // Line
  chartCtx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w, y = h - (v / 100) * h;
    i === 0 ? chartCtx.moveTo(x, y) : chartCtx.lineTo(x, y);
  });
  chartCtx.strokeStyle = 'rgba(38,208,178,0.8)'; chartCtx.lineWidth = 1.8; chartCtx.stroke();
}

// ── UPDATE UI ─────────────────────────────
function updateTempUI() {
  const t = window.S_TEMP.current;
  const mode = t >= TEMP_DANGER ? 'danger' : t >= TEMP_WARN ? 'warn' : 'safe';

  // Big number
  const big = document.getElementById('tempBig');
  if (big) { big.innerHTML = `${t.toFixed(1)}<span class="temp-unit">°C</span>`; big.className = `temp-big ${mode}`; }

  // Current reading box
  const cur = document.getElementById('rCurrent');
  if (cur) cur.textContent = `${t.toFixed(1)}°C`;

  // Badge
  const badge = document.getElementById('tempBadge');
  if (badge) { badge.textContent = mode === 'danger' ? 'DANGER' : mode === 'warn' ? 'WARNING' : 'SAFE'; badge.className = `badge badge-${mode === 'safe' ? 'ok' : mode === 'warn' ? 'warn' : 'danger'}`; }

  // Status pill
  const pill = document.getElementById('tempPill');
  if (pill) {
    const labels = { safe: '<div class="sys-dot green"></div> Safe — Within limits', warn: '<div class="sys-dot orange" style="background:var(--orange)"></div> Warning — Nearing limit!', danger: '<div class="sys-dot red" style="background:var(--red)"></div> DANGER — Exceeds threshold!' };
    pill.innerHTML = labels[mode];
    pill.className = `temp-pill ${mode}`;
  }

  // Gauge needle: -90deg = 0°C, +90deg = 100°C
  const needle = document.getElementById('gneedle');
  if (needle) needle.setAttribute('transform', `rotate(${-90 + (t / 100) * 180},90,88)`);

  // Max/min tracking — initialize on first real reading
  if (window.S_TEMP.history.length === 1) {
    window.S_TEMP.max = t;
    window.S_TEMP.min = t;
  }
  if (t > window.S_TEMP.max) {
    window.S_TEMP.max = t;
    const maxEl = document.getElementById('rMax');
    if (maxEl) maxEl.textContent = `${t.toFixed(1)}°C`;
  }
  if (t < window.S_TEMP.min) {
    window.S_TEMP.min = t;
    const minEl = document.getElementById('rMin');
    if (minEl) minEl.textContent = `${t.toFixed(1)}°C`;
  }

  // Fire danger alert once per spike
  if (mode === 'danger' && !window.S_TEMP.alertFired) {
    window.S_TEMP.alertFired = true;
    log('ERROR', `Temperature exceeded ${TEMP_DANGER}°C — current: ${t.toFixed(1)}°C`);
    notify('danger', '🌡 Temperature DANGER', `Zone A reads ${t.toFixed(1)}°C — ${TEMP_DANGER}°C limit exceeded.`);
    const bar = document.getElementById('tempAlertBar');
    if (bar) { document.getElementById('tempAlertTitle').textContent = 'Temperature Danger'; document.getElementById('tempAlertDesc').textContent = `${t.toFixed(1)}°C exceeds the ${TEMP_DANGER}°C safe limit.`; bar.classList.add('show'); }
    S.violations++;
    updateOvStats();
    updateNavBadges();
  }
  if (mode !== 'danger') window.S_TEMP.alertFired = false;

  updateOvStats();
  updateNavBadges();
}

// ── ZONE CARDS ────────────────────────────
function renderZones() {
  const grid = document.getElementById('zonesGrid');
  if (!grid) return;
  grid.innerHTML = window.S_TEMP.zones.map((z, i) => {
    const pct = Math.min((z.temp / 60) * 100, 100);
    const zm  = z.temp >= TEMP_DANGER ? 'danger' : z.temp >= TEMP_WARN ? 'warn' : 'ok';
    const bar = zm === 'danger' ? 'var(--red)' : zm === 'warn' ? 'var(--orange)' : 'var(--teal)';
    return `<div class="zone-card zone-card-${i + 1}">
      <div class="zone-name">${z.name}</div>
      <div class="zone-temp ${zm}">${z.temp.toFixed(1)}°C</div>
      <div class="zone-sub">${z.label}</div>
      <div class="zone-bar-bg"><div class="zone-bar-fill" style="width:${pct}%;background:${bar}"></div></div>
    </div>`;
  }).join('');
}

// ── SIMULATE SPIKE ────────────────────────
function simTempSpike() {
  const target = 52 + Math.random() * 10;
  animTemp(window.S_TEMP.current, target, 2000);
}

function resetTemp() {
  animTemp(window.S_TEMP.current, 26 + Math.random() * 4, 1500);
  const bar = document.getElementById('tempAlertBar');
  if (bar) bar.classList.remove('show');
  log('OK', 'Temperature normalized to safe range');
}

function animTemp(from, to, duration) {
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const e = p < 0.5 ? 2 * p * p : (4 - 2 * p) * p - 1;
    window.S_TEMP.current = from + (to - from) * e;
    window.S_TEMP.history.push(window.S_TEMP.current);
    if (window.S_TEMP.history.length > 80) window.S_TEMP.history.shift();
    // Sync zones
    window.S_TEMP.zones[0].temp = window.S_TEMP.current;
    window.S_TEMP.zones[2].temp = window.S_TEMP.current * 0.85 + 4;
    updateTempUI();
    drawChart();
    renderZones();
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── AUTO DRIFT DISABLED ───────────────────
// Real DHT11 values come from server.py via WebSocket (socket 'temperature' event below).
// Drift simulation removed so it no longer overwrites real sensor readings.

// ── INIT ──────────────────────────────────
window.addEventListener('load', () => {
  updateTempUI();
  renderZones();
  log('INFO', 'DHT11 sensor active — waiting for ESP32 readings...');
});

window.addEventListener('resize', () => { if (chartCtx) initChart(); });

// ════════════════════════════════════════
// REAL ESP32 + DHT11 INTEGRATION
// socket is created in app.js — receives data from server.py serial reader
// ════════════════════════════════════════
socket.on('temperature', (data) => {
  // data = { temperature: 26.5, humidity: 60.0 }
  window.S_TEMP.current = data.temperature;
  window.S_TEMP.history.push(data.temperature);
  if (window.S_TEMP.history.length > 80) window.S_TEMP.history.shift();
  window.S_TEMP.zones[0].temp = data.temperature;
  window.S_TEMP.zones[2].temp = data.temperature * 0.85 + 4;

  const humEl = document.getElementById('humidityVal');
  if (humEl) humEl.textContent = `${data.humidity.toFixed(1)}%`;

  updateTempUI();
  drawChart();
  renderZones();
  log('INFO', `DHT11: ${data.temperature.toFixed(1)}°C | ${data.humidity.toFixed(1)}% humidity`);
});
