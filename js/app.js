/* ════════════════════════════════════════
   app.js — Shared State, Navigation, Clock
   Edit this file to change global app behaviour
════════════════════════════════════════ */

// ── SHARED STATE ──────────────────────────
// All modules read/write to this object.
// poles.js, temperature.js, workers.js all import from here.
const S = {
  violations: 0,
  notifCount: 0,
  activities: [],
};

// ── SHARED SOCKET ─────────────────────────
// Created here so ALL modules (temperature.js, workers.js) can use it.
// server.py must be running on localhost:5000
const socket = io('http://localhost:5000');
socket.on('connect',    () => console.log('Socket connected to server.py'));
socket.on('disconnect', () => console.log('Socket disconnected from server.py'));

// ── PAGE TITLES ───────────────────────────
const PAGE_TITLES = {
  overview:    'Overview <span class="page-sub">Supply Chain Monitor</span>',
  poles:       'Pole Monitor <span class="page-sub">ESP32 Wire Detection</span>',
  temperature: 'Temperature <span class="page-sub">Environmental Sensor</span>',
  workers:     'Face Recognition <span class="page-sub">CNN Overtime Tracker</span>',
};

// ── NAVIGATION ────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').innerHTML = PAGE_TITLES[id];

  // Tell each module to re-render when their page is shown
  if (id === 'poles')       renderMap();
  if (id === 'temperature') { initChart(); renderZones(); }
  if (id === 'workers')     renderWorkers();
}

// ── CLOCK ─────────────────────────────────
function updateClock() {
  const el = document.getElementById('clockEl');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ── LOGGING ───────────────────────────────
function log(type, msg) {
  const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });

  // Write to the workers page log terminal
  const el = document.getElementById('logEl');
  if (el) {
    const row = document.createElement('div');
    row.className = 'log-row';
    row.innerHTML = `<span class="log-ts">[${ts}]</span><span class="log-type ${type}">${type}</span><span class="log-msg">${msg}</span>`;
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
  }

  addActivity(type, msg, ts);
}

// ── ACTIVITY FEED ─────────────────────────
function addActivity(type, msg, ts) {
  const dotClass = type === 'ERROR' ? 'danger' : type === 'WARN' ? 'warn' : type === 'OK' ? 'ok' : 'info';
  S.activities.unshift({ dotClass, msg, ts });
  if (S.activities.length > 8) S.activities.pop();
  renderActivity();
  const badge = document.getElementById('actBadge');
  if (badge) badge.textContent = `${S.activities.length} events`;
}

function renderActivity() {
  const feed = document.getElementById('actFeed');
  if (!feed) return;
  feed.innerHTML = S.activities.map(a => `
    <div class="activity-item">
      <div class="a-dot ${a.dotClass}"></div>
      <div>
        <div class="a-msg">${a.msg}</div>
        <div class="a-ts">${a.ts}</div>
      </div>
    </div>`).join('');
}

// ── NOTIFICATIONS ─────────────────────────
function notify(type, title, body) {
  S.notifCount++;
  const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
  const html = `
    <div class="notif-item ${type}">
      <div class="notif-title">${title}</div>
      <div class="notif-body">${body}</div>
      <div class="notif-time">${ts}</div>
    </div>`;

  // Push to both notification panels
  ['notifList', 'notifList2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.insertAdjacentHTML('afterbegin', html);
  });

  const badge = document.getElementById('notifBadge');
  if (badge) { badge.textContent = `${S.notifCount} alerts`; badge.className = 'badge badge-danger'; }
}

// ── OVERVIEW STATS ────────────────────────
// Called by poles.js, temperature.js, workers.js after any change
function updateOvStats() {
  // Poles
  const broken = window.S_POLES ? window.S_POLES.filter(p => p.status === 'broken').length : 0;
  const ovPoles = document.getElementById('ov-poles');
  if (ovPoles) ovPoles.textContent = 9 - broken;
  setEl('ov-poles-sub', broken > 0 ? `⚠ ${broken} broken` : 'All operational', broken > 0 ? 'danger' : 'ok');
  setMcStatus('ov-pole-status', broken > 0 ? 'var(--red)' : 'var(--teal)', broken > 0 ? `${broken} wire break(s)` : '9 poles online');

  // Temp
  const temp = window.S_TEMP ? window.S_TEMP.current : 28;
  setEl('ov-temp', `${temp.toFixed(0)}°C`);
  const tm = temp >= 45 ? 'danger' : temp >= 38 ? 'warn' : 'ok';
  setEl('ov-temp-sub', tm === 'ok' ? 'Within safe range' : tm === 'warn' ? '⚠ Approaching limit' : '⚠ CRITICAL', tm);
  setMcStatus('ov-temp-status', tm === 'ok' ? 'var(--green)' : tm === 'warn' ? 'var(--orange)' : 'var(--red)', `${temp.toFixed(1)}°C — ${tm === 'ok' ? 'Safe' : tm === 'warn' ? 'Warning' : 'DANGER'}`);

  // Workers overtime
  const ot = window.S_WORKERS ? window.S_WORKERS.filter(w => w.totalSeconds >= w.overtimeLimit).length : 0;
  setEl('ov-work-sub', ot > 0 ? `⚠ ${ot} overtime` : 'No overtime', ot > 0 ? 'danger' : 'ok');
  setMcStatus('ov-face-status', ot > 0 ? 'var(--red)' : 'var(--green)', ot > 0 ? `${ot} overtime alert(s)` : '4 tracked, no overtime');

  // Violations
  setEl('ov-viol', S.violations);
  setEl('ov-viol-sub', S.violations > 0 ? `⚠ ${S.violations} today` : 'Clean record', S.violations > 0 ? 'danger' : 'ok');
}

// Helper: set element text + stat-sub class
function setEl(id, text, subClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (subClass) el.className = `stat-sub ${subClass}`;
}

// Helper: set module card status dot + text
function setMcStatus(id, color, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<span class="mc-status-dot" style="background:${color}"></span>${text}`;
}

// ── NAV BADGES ────────────────────────────
function updateNavBadges() {
  const broken = window.S_POLES ? window.S_POLES.filter(p => p.status === 'broken').length : 0;
  setNavBadge('navPoleBadge', broken > 0, broken > 0 ? `${broken}!` : 'OK');

  const temp = window.S_TEMP ? window.S_TEMP.current : 28;
  const tBad = temp >= 38;
  setNavBadge('navTempBadge', tBad, tBad ? (temp >= 45 ? '!' : 'WARN') : 'OK');

  const ot = window.S_WORKERS ? window.S_WORKERS.filter(w => w.totalSeconds >= w.overtimeLimit).length : 0;
  setNavBadge('navFaceBadge', ot > 0, ot > 0 ? `${ot}!` : 'OK');

  const anyAlert = broken > 0 || tBad || ot > 0;
  const dot  = document.getElementById('sysDot');
  const text = document.getElementById('sysText');
  if (dot)  dot.className  = `sys-dot ${anyAlert ? 'orange' : 'green'}`;
  if (text) text.textContent = anyAlert ? 'Alert active' : 'All systems live';
}

function setNavBadge(id, isAlert, label) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = label;
  el.className = `nav-badge ${isAlert ? 'alert' : 'ok'}`;
}

// ── COMBINED DEMO ACTIONS ─────────────────
function simAll() {
  simBreak();
  setTimeout(simTempSpike, 800);
  setTimeout(simOvertime,  1600);
}

function resetAll() {
  resetPoles();
  resetTemp();
  resetWorkers();
  S.violations = 0;
  S.notifCount = 0;
  const nb = document.getElementById('notifBadge');
  if (nb) { nb.textContent = '0 alerts'; nb.className = 'badge badge-ok'; }
  ['faceAlertBar', 'tempAlertBar', 'poleAlertBar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  });
  log('OK', 'All systems reset to nominal');
  updateOvStats();
  updateNavBadges();
}

// ── INIT ──────────────────────────────────
window.addEventListener('load', () => {
  log('INFO', 'SupplyGuard initialized');
  log('OK',   'All systems operational');
  updateOvStats();
  updateNavBadges();
});
