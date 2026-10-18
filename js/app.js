// TAMUR — Open the Safe: scene direction + game flow.
import { createSfx } from './sfx.js';

const gsap = window.gsap;
const API = 'https://eahpfrvevrwyoqkpysqp.supabase.co/functions/v1/safe-api';
const $ = id => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) gsap.globalTimeline.timeScale(5);
const sfx = createSfx();
const haptic = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* unsupported */ } };
const wait = s => new Promise(r => setTimeout(r, s * 1000));

/* ---------- device id (attempt limits are enforced on the server) ---------- */
const newId = () => (crypto.randomUUID && crypto.randomUUID()) || ('d' + Date.now() + Math.random().toString(16).slice(2));
let deviceId;
try { deviceId = localStorage.getItem('tamur_device'); if (!deviceId) { deviceId = newId(); localStorage.setItem('tamur_device', deviceId); } }
catch (e) { deviceId = newId(); }

/* ---------- UTM (first touch) ---------- */
const utm = (() => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('tamur_utm') || '{}'); } catch (e) { /* ignore */ }
  const q = new URLSearchParams(location.search); let got = false;
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => { const v = q.get(k); if (v) { saved[k] = v; got = true; } });
  if (got) { try { localStorage.setItem('tamur_utm', JSON.stringify(saved)); } catch (e) { /* ignore */ } }
  return saved;
})();

/* ---------- analytics: queued until the server says the campaign is live; dropped in test mode ---------- */
let live = null;          // null = unknown, true = real campaign, false = test mode
const queue = [];
function sendEvent(ev) {
  try {
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ action: 'event', deviceId, name: ev.name, ts: ev.ts, utm, ref: document.referrer || '' }) }).catch(() => {});
  } catch (e) { /* never block the experience */ }
}
function track(name) {
  if (live === false) return;
  const ev = { name, ts: Date.now() };
  if (live === true) sendEvent(ev); else queue.push(ev);
}
function setLive(isLive) { live = isLive; const q = queue.splice(0); if (isLive) q.forEach(sendEvent); }

/* ---------- server call: contract unchanged (action, deviceId, +extra) ---------- */
let testMode = false;
async function call(action, extra) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ action, deviceId }, extra || {})), signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (j && j.testMode) { testMode = true; return j; }
    if (!r.ok) throw new Error(j && j.error === 'Game not activated yet'
      ? 'O‘yin hali faollashtirilmagan. Iltimos, keyinroq urinib ko‘ring.'
      : (j && j.error) || 'Server xatosi. Qayta urinib ko‘ring.');
    return j || {};
  } finally { clearTimeout(t); }
}
const errText = e => (e && e.name === 'AbortError') ? 'Server javobi kechikdi. Qayta urinib ko‘ring.' : ((e && e.message) || 'Xatolik yuz berdi.');

let noticeT = 0;
function notice(msg) {
  const n = $('notice'); n.textContent = msg; n.classList.add('show');
  clearTimeout(noticeT); noticeT = setTimeout(() => n.classList.remove('show'), 4200);
}

/* =================================================================
   VAULT: 3D (Three.js) with a lightweight 2D fallback
   ================================================================= */
let vault = null;
const vaultReady = (async () => {
  try {
    const m = await import('./vault3d.js');
    vault = await m.createVault($('gl'), { reduced, sfx, haptic, logoSrc: 'tamur-logo-mark.png' });
  } catch (e) {
    console.warn('[TAMUR] 3D unavailable, using 2D fallback:', e && e.message);
    vault = createFallback();
  }
  vault.onFrame(placeControls);
  window.__digits = () => vault.digits();   // read-only, for automated UI tests
  return vault;
})();

function createFallback() {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:10px;opacity:0';
  $('stage').appendChild(host);
  const vals = [0, 0, 0, 0, 0], els = vals.map(() => {
    const d = document.createElement('div');
    d.style.cssText = 'width:min(15vw,62px);height:min(19vw,78px);border-radius:14px;display:grid;place-items:center;font:500 34px Poppins,sans-serif;color:#efdcb4;background:linear-gradient(180deg,#0b0a09,#2a2622 50%,#0b0a09);box-shadow:inset 0 0 0 1px rgba(230,204,156,.35),0 10px 30px rgba(0,0,0,.6)';
    d.textContent = '0'; host.appendChild(d); return d;
  });
  const cbs = []; (function f() { requestAnimationFrame(f); cbs.forEach(c => c()); })();
  const set = (i, v) => { vals[i] = ((v % 10) + 10) % 10; els[i].textContent = vals[i]; gsap.fromTo(els[i], { y: -6 }, { y: 0, duration: 0.2 }); sfx.tick(); };
  const tl = () => gsap.timeline();
  let base = 0;
  return {
    is3D: false, onFrame: c => cbs.push(c), digits: () => vals.slice(),
    reveal: () => tl().to(host, { opacity: 0.35, duration: 1 }),
    activate: () => tl().to(host, { opacity: 1, duration: 0.6 }),
    step(i, dir) { set(i, vals[i] + dir); return vals[i]; },
    dragBegin(i) { base = vals[i]; }, dragUpdate() {}, dragEnd(i, d, v) { set(i, base + Math.round(d + v * 0.16)); return vals[i]; },
    setActive(i) { els.forEach((e, k) => { e.style.boxShadow = k === i ? 'inset 0 0 0 1px #e6cc9c,0 0 24px rgba(230,204,156,.35)' : 'inset 0 0 0 1px rgba(230,204,156,.35),0 10px 30px rgba(0,0,0,.6)'; }); },
    drumScreen: () => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, half: r.height / 2, halfW: r.width / 2 }; }),
    submitA: () => tl().to(els, { boxShadow: 'inset 0 0 0 1px #f6e8c8,0 0 30px rgba(230,204,156,.6)', stagger: 0.09, duration: 0.3 }).to({}, { duration: 1.2 }),
    abortSubmit: () => tl(), submitB: () => tl().to({}, { duration: 0.9 }),
    resetClosed() {}, settle: () => tl(), pause() {}, resume() {}, sweepLight() {},
  };
}

/* =================================================================
   CONTROLS: arrows + swipe zones that follow the 3D drums
   ================================================================= */
const ctrl = { ups: [], downs: [], zones: [], visible: false };
const chevron = up => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${up ? 'M6 14.5 12 8.5l6 6' : 'M6 9.5l6 6 6-6'}"/></svg>`;
(function buildControls() {
  const host = $('controls');
  for (let i = 0; i < 5; i++) {
    const z = document.createElement('div'); z.className = 'zone live'; z.dataset.i = i; host.appendChild(z); ctrl.zones.push(z);
    for (const dir of [1, -1]) {
      const b = document.createElement('button');
      b.className = 'ar live'; b.innerHTML = chevron(dir > 0);
      b.setAttribute('aria-label', `${i + 1}-raqamni ${dir > 0 ? 'oshirish' : 'kamaytirish'}`);
      b.addEventListener('click', () => stepDrum(i, dir, b));
      host.appendChild(b); (dir > 0 ? ctrl.ups : ctrl.downs).push(b);
    }
    bindSwipe(z, i);
  }
})();
function placeControls() {
  if (!ctrl.visible || !vault) return;
  const pts = vault.drumScreen();
  const spacing = Math.abs(pts[1].x - pts[0].x);
  const aw = Math.max(36, Math.min(58, spacing * 0.86));
  $('controls').style.setProperty('--aw', aw + 'px');
  pts.forEach((p, i) => {
    const gap = p.half + 28;
    ctrl.ups[i].style.transform = `translate(${p.x - aw / 2}px,${p.y - gap - 18}px)`;
    ctrl.downs[i].style.transform = `translate(${p.x - aw / 2}px,${p.y + gap - 18}px)`;
    const zw = Math.max(p.halfW * 2 + 6, aw), zh = p.half * 2 + 18;
    const z = ctrl.zones[i]; z.style.width = zw + 'px'; z.style.height = zh + 'px';
    z.style.transform = `translate(${p.x - zw / 2}px,${p.y - zh / 2}px)`;
  });
}
let activeDrum = 0;
function stepDrum(i, dir, btn) {
  if (busy || phase !== 'game' || !vault) return;
  sfx.init(); activeDrum = i;
  vault.step(i, dir);
  if (btn) { btn.classList.add('hit'); setTimeout(() => btn.classList.remove('hit'), 160); }
}
function bindSwipe(zone, i) {
  let drag = null;
  zone.addEventListener('pointerdown', e => {
    if (busy || phase !== 'game' || !vault) return;
    e.preventDefault(); sfx.init();
    try { zone.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    const p = vault.drumScreen()[i];
    drag = { y0: e.clientY, last: e.clientY, t: performance.now(), v: 0, stepPx: Math.max(16, p.half * 0.85), moved: false, cy: p.y };
    activeDrum = i; vault.dragBegin(i);
  });
  zone.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = drag.y0 - e.clientY;
    if (Math.abs(dy) > 6) drag.moved = true;
    const now = performance.now(), dt = Math.max(8, now - drag.t);
    const inst = ((drag.last - e.clientY) / drag.stepPx) / dt * 1000;
    drag.v = drag.v * 0.7 + inst * 0.3; drag.last = e.clientY; drag.t = now;
    vault.dragUpdate(i, dy / drag.stepPx);
  });
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) { vault.dragEnd(i, 0, 0); vault.step(i, e.clientY < d.cy ? 1 : -1); return; }
    vault.dragEnd(i, (d.y0 - e.clientY) / d.stepPx, performance.now() - d.t > 90 ? 0 : d.v);
  };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
}
document.addEventListener('keydown', e => {
  if (phase !== 'game' || busy || !vault) return;
  if (e.key === 'ArrowUp') { e.preventDefault(); stepDrum(activeDrum, 1); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); stepDrum(activeDrum, -1); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault(); activeDrum = (activeDrum + (e.key === 'ArrowRight' ? 1 : 4)) % 5; vault.setActive(activeDrum); sfx.tick();
  } else if (/^[0-9]$/.test(e.key)) {
    const cur = vault.digits()[activeDrum], target = +e.key; let diff = target - cur;
    if (diff > 5) diff -= 10; if (diff < -5) diff += 10;
    for (let k = 0; k < Math.abs(diff); k++) setTimeout(() => vault.step(activeDrum, Math.sign(diff)), k * 70);
    setTimeout(() => { activeDrum = Math.min(4, activeDrum + 1); vault.setActive(activeDrum); }, Math.abs(diff) * 70 + 60);
  } else if (e.key === 'Enter') { e.preventDefault(); onSubmit(); }
});

/* =================================================================
   STATE
   ================================================================= */
let phase = 'intro', busy = false, count = 0;

function renderPips(animate) {
  const used = Math.min(3, count);
  [...$('pips').children].forEach((p, k) => {
    const isUsed = k >= 3 - used;
    if (animate && isUsed && !p.classList.contains('used')) gsap.fromTo(p, { scale: 1.8 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1,.5)' });
    p.classList.toggle('used', isUsed);
  });
  $('anum').textContent = String(3 - used);
}

/* split the headline into animatable glyphs */
function splitGlyphs(el) {
  const out = [];
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        [...n.textContent].forEach(ch => {
          const s = document.createElement('span');
          if (ch === ' ') { s.className = 'sp'; s.innerHTML = '&nbsp;'; } else { s.className = 'ch'; s.textContent = ch; out.push(s); }
          s.setAttribute('aria-hidden', 'true'); frag.appendChild(s);
        });
        n.replaceWith(frag);
      } else walk(n);
    });
  };
  walk(el); return out;
}
const titleChars = splitGlyphs($('title'));
const thanksChars = splitGlyphs($('thanks'));

/* =================================================================
   SCENE 01–02: cinematic intro + vault reveal
   ================================================================= */
function brandCenterOffset() {
  const r = $('brand').getBoundingClientRect(), lr = $('logoWrap').getBoundingClientRect();
  return { x: innerWidth / 2 - (lr.left + lr.width / 2), y: innerHeight / 2 - (r.top + r.height / 2) };
}
function intro() {
  const off = brandCenterOffset();
  gsap.set('#brand', { x: off.x, y: off.y, scale: 1.45, transformOrigin: '50% 50%' });
  gsap.set('#logoWrap', { opacity: 0, scale: 0.92, filter: 'blur(10px) drop-shadow(0 0 0 rgba(233,200,140,0))' });
  gsap.set(['#rule', '#date', '#place'], { opacity: 0 });
  gsap.set(titleChars, { opacity: 0, y: 34, filter: 'blur(10px)' });
  gsap.set(['#lead', '#startBtn'], { opacity: 0, y: 18 });
  gsap.set('#startBtn', { pointerEvents: 'none' });

  const tl = gsap.timeline();
  tl.to('#logoWrap', { opacity: 1, scale: 1, filter: 'blur(0px) drop-shadow(0 0 26px rgba(233,200,140,.35))', duration: 1.5, ease: 'power3.out' }, 0.2)
    .to('#logo', { backgroundPosition: '0% 0', duration: 1.5, ease: 'power2.inOut' }, 0.95)             // light sweep over the logo
    .to('#curtain', { opacity: 0, duration: 2.0, ease: 'power1.inOut' }, 0.6)
    .fromTo('#bg', { scale: 1.38, opacity: 0, filter: 'blur(6px) brightness(.7)' },
      { scale: 1.06, opacity: 1, filter: 'blur(0px) brightness(1)', duration: 3.6, ease: 'power2.out' }, 0.5) // storefront: cinematic zoom
    .fromTo('#rule', { scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 1.0, ease: 'power3.out' }, 1.55)
    .fromTo('#date', { letterSpacing: '.75em' }, { opacity: 1, letterSpacing: '.38em', duration: 1.5, ease: 'power3.out' }, 1.7)
    .to('#place', { opacity: 1, duration: 1.0 }, 2.1)
    .to('#brand', { x: 0, y: 0, scale: 1, duration: 1.3, ease: 'power3.inOut' }, 2.6)                 // header settles, camera heads to the vault
    .to('#logoWrap', { filter: 'blur(0px) drop-shadow(0 0 18px rgba(233,200,140,.22))', duration: 1 }, 2.6)
    .to('#bgDim', { opacity: 0.45, duration: 2.2, ease: 'power2.inOut' }, 2.7)
    .to('#bg', { scale: 1.0, duration: 6, ease: 'none' }, 4.1);

  // 3D vault joins as soon as it is ready (never before 2.0 s)
  const t0 = performance.now();
  vaultReady.then(v => {
    const delay = Math.max(0, 2.0 - (performance.now() - t0) / 1000);
    gsap.delayedCall(delay, () => {
      v.reveal();
      const t2 = gsap.timeline({ delay: 1.45 });
      t2.to(titleChars, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', stagger: 0.045 }, 0)
        .to(titleChars, { backgroundPosition: '90% 0', duration: 2.4, ease: 'power2.inOut', stagger: 0.03 }, 0.4)
        .to('#lead', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0.75)
        .to('#startBtn', { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out', onComplete: () => {
          gsap.set('#startBtn', { pointerEvents: 'auto' }); $('startBtn').classList.add('shine');
          setTimeout(() => $('startBtn').classList.remove('shine'), 1400);
        } }, 1.0);
    });
  });
  track('landing_view');
}

/* =================================================================
   SCENE 03: game activation
   ================================================================= */
const wide = () => innerWidth / innerHeight > 1.15 && innerWidth >= 760;
function showGameUI(first) {
  phase = 'game';
  $('gameUI').hidden = false; ctrl.visible = true; placeControls();
  const tl = gsap.timeline();
  tl.fromTo('#ghead > *', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, 0);
  ctrl.ups.forEach((b, i) => tl.fromTo([b, ctrl.downs[i]], { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, (first ? 0 : 0.05) + i * 0.12));
  tl.fromTo('#gfoot > *', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }, 0.35);
  $('sendBtn').disabled = false;
  vault.setActive(activeDrum);
  return tl;
}
function hideGameUI() {
  const tl = gsap.timeline({ onComplete: () => { ctrl.visible = false; $('gameUI').hidden = true; } });
  tl.to(['#ghead', '#gfoot', ...ctrl.ups, ...ctrl.downs], { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0);
  tl.set(['#ghead', '#gfoot'], { opacity: 1 });
  return tl;
}

async function onStart() {
  if (phase !== 'intro' || busy) return;
  busy = true; sfx.init(); sfx.tap(); haptic(10);
  const btn = $('startBtn'); btn.disabled = true; btn.classList.add('loading');
  track('opening_cta_click'); track('participation_start');
  warmVideo();
  let res;
  try { [res] = await Promise.all([call('start'), vaultReady]); }
  catch (e) { btn.disabled = false; btn.classList.remove('loading'); busy = false; notice(errText(e)); return; }
  btn.classList.remove('loading');
  if (testMode) { setLive(false); count = 0; $('testTag').hidden = false; }
  else { setLive(true); count = res.attempts || 0; }
  renderPips(false);

  // leave the intro
  const out = gsap.timeline();
  out.to(titleChars, { opacity: 0, y: -18, filter: 'blur(8px)', duration: 0.5, stagger: 0.015, ease: 'power2.in' }, 0)
     .to(['#lead', '#startBtn'], { opacity: 0, y: 14, duration: 0.4, ease: 'power2.in' }, 0)
     .to(['#rule', '#date', '#place'], { opacity: 0, duration: 0.4 }, 0)
     .to('#bgDim', { opacity: 0.62, duration: 1.2 }, 0)
     .set('#introUI', { display: 'none' }, 0.6)
     .to('#brand', { scale: 0.8, transformOrigin: wide() ? '0% 0%' : '50% 0%', duration: 0.9, ease: 'power3.inOut' }, 0.1);

  if (!testMode && res.finished) { await out; await toFinale(); busy = false; return; }
  phase = 'activating';
  const act = vault.activate();
  await gsap.timeline().add(out, 0).add(act, 0.1);
  await showGameUI(true);
  if (!testMode && res.needsPhone) { showPhone(); }
  busy = false;
}

/* =================================================================
   SCENE 05: code submission — identical for every player
   ================================================================= */
async function onSubmit() {
  if (busy || phase !== 'game' || !vault) return;
  busy = true; sfx.init(); sfx.tap(); haptic(12);
  $('sendBtn').disabled = true;
  const code = vault.digits().join('');
  track('code_attempt');
  hideGameUI();
  phase = 'submitting';

  const server = testMode ? Promise.resolve({ testMode: true }) : call('attempt', { code });
  const settled = server.then(r => ({ ok: true, r }), e => ({ ok: false, e }));
  await Promise.all([vault.submitA(), settled]);
  const out = await settled;

  if (!out.ok) {                                  // server failed: the attempt did not count — restore the lock
    await vault.abortSubmit();
    await showGameUI();
    notice(errText(out.e)); busy = false; return;
  }
  const res = out.r;
  let next;
  if (testMode) { count = Math.min(3, count + 1); next = count === 1 ? 'phone' : count >= 3 ? 'finale' : 'game'; }
  else { count = typeof res.attempts === 'number' ? res.attempts : count + 1; next = res.needsPhone ? 'phone' : res.finished ? 'finale' : 'game'; }
  if (next === 'finale') track('attempts_exhausted');

  const tlB = vault.submitB();
  gsap.to('#flash', { opacity: 1, duration: 0.5, ease: 'power2.in', delay: reduced ? 0 : 0.6 });
  await tlB; await wait(0.12);
  renderPips(true);
  if (next === 'finale') { await toFinale(); busy = false; return; }

  vault.resetClosed('game');
  gsap.to('#flash', { opacity: 0, duration: 1.0, ease: 'power2.out' });
  vault.settle('game');
  if (next === 'phone') showPhone();
  else { await wait(0.35); await showGameUI(); }
  busy = false;
}

/* =================================================================
   SCENE 06: phone number (glass-metal panel)
   ================================================================= */
function showPhone() {
  phase = 'phone';
  $('phoneUI').hidden = false; $('perr').textContent = '';
  gsap.to('#scrim', { opacity: 1, duration: 0.8 });
  gsap.fromTo('#panel', { y: 90, opacity: 0, filter: 'blur(14px)', scale: 0.98 }, { y: 0, opacity: 1, filter: 'blur(0px)', scale: 1, duration: 1.0, ease: 'power3.out', delay: 0.15 });
  gsap.fromTo('#panel > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', delay: 0.35 });
}
function formatPhone(v) {
  let p = v.replace(/\D/g, ''); if (p.startsWith('998')) p = p.slice(3); p = p.slice(0, 9);
  let o = '+998'; if (p.length) o += ' ' + p.slice(0, 2); if (p.length > 2) o += ' ' + p.slice(2, 5);
  if (p.length > 5) o += ' ' + p.slice(5, 7); if (p.length > 7) o += ' ' + p.slice(7, 9); return o;
}
$('tel').addEventListener('focus', e => { if (!e.target.value) e.target.value = '+998 '; });
$('tel').addEventListener('input', e => { e.target.value = formatPhone(e.target.value); $('perr').textContent = ''; });
async function onPhone() {
  if (phase !== 'phone' || busy) return;
  sfx.init(); sfx.tap();
  let p = $('tel').value.replace(/\D/g, ''); if (p.startsWith('998')) p = p.slice(3);
  if (p.length !== 9) { $('perr').textContent = 'Raqamni to‘liq kiriting: +998 XX XXX XX XX'; haptic([10, 40, 10]); return; }
  if (!$('consent').checked) { $('perr').textContent = 'Davom etish uchun rozilik belgisini qo‘ying.'; haptic([10, 40, 10]); return; }
  busy = true; $('phoneBtn').disabled = true; $('phoneBtn').classList.add('loading');
  let res = {};
  try { if (!testMode) res = await call('phone', { phone: '+998' + p }); }   // test mode: nothing is sent or stored
  catch (e) { $('perr').textContent = errText(e); busy = false; $('phoneBtn').disabled = false; $('phoneBtn').classList.remove('loading'); return; }
  $('phoneBtn').classList.remove('loading'); $('phoneBtn').disabled = false;
  $('tel').blur();
  await gsap.timeline()
    .to('#panel', { opacity: 0, scale: 0.95, y: 24, filter: 'blur(12px)', duration: 0.65, ease: 'power2.in' }, 0)
    .to('#scrim', { opacity: 0, duration: 0.8 }, 0.2);
  $('phoneUI').hidden = true;
  if (!testMode && res.finished) { await toFinale(); busy = false; return; }
  vault.sweepLight();
  await vault.settle('game');
  await showGameUI();
  busy = false;
}

/* =================================================================
   SCENE 08: grand finale
   ================================================================= */
let videoWarm = false;
function warmVideo() {
  if (videoWarm) return; videoWarm = true;
  const v = $('finalVideo');
  try {
    v.src = 'TAMUR_video_GitHub.mp4'; v.preload = 'auto'; v.muted = false; v.volume = 0; v.load();
    const p = v.play(); if (p && p.then) p.then(() => { v.pause(); v.currentTime = 0; }).catch(() => {});  // unlocks sound on iOS (user gesture)
  } catch (e) { /* ignore */ }
}
function playVideo() {
  const v = $('finalVideo'); warmVideo();
  if (wide()) { const b = $('finalVideoBg'); b.src = v.currentSrc || 'TAMUR_video_GitHub.mp4'; b.muted = true; b.play().catch(() => {}); }
  v.muted = false; v.volume = 0.8;
  const p = v.play();
  const fallback = () => {
    v.muted = true; v.play().catch(() => {});
    const tip = $('tapSound'); tip.classList.add('show');
    const un = () => { v.muted = false; v.play().catch(() => {}); tip.classList.remove('show'); };
    document.addEventListener('pointerdown', un, { once: true });
    setTimeout(() => tip.classList.remove('show'), 6000);
  };
  if (p && p.catch) p.catch(fallback);
}
async function toFinale() {
  phase = 'finale';
  ctrl.visible = false;
  if (+getComputedStyle($('flash')).opacity < 0.99) await gsap.to('#flash', { opacity: 1, duration: 0.6, ease: 'power2.in' });
  $('ui').style.display = 'none'; $('stage').style.visibility = 'hidden'; vault && vault.pause();
  $('finale').hidden = false;
  playVideo(); sfx.chime();
  gsap.set(thanksChars, { opacity: 0, y: 40, filter: 'blur(12px)' });
  gsap.set(['#fbrand', '#fline1', '#fline2', '#links > *'], { opacity: 0 });
  const tl = gsap.timeline();
  tl.to('#vwrap', { clipPath: 'circle(150% at 50% 50%)', duration: 1.6, ease: 'power2.inOut' }, 0)
    .to('#finalVideo', { scale: 1, duration: 3.2, ease: 'power2.out' }, 0)
    .to('#flash', { opacity: 0, duration: 1.4, ease: 'power2.out' }, 0.15)
    .fromTo('#fbrand', { y: -18 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }, 0.7)
    .to(thanksChars, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.06, ease: 'power3.out' }, 1.0)
    .to(thanksChars, { backgroundPosition: '90% 0', duration: 2.2, stagger: 0.04, ease: 'power2.inOut' }, 1.5)
    .fromTo('#fline1', { y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 1.6)
    .fromTo('#fline2', { y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 1.75)
    .fromTo('#links > *', { y: 20 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 2.0);
  await tl;
}
$('instagram').addEventListener('click', () => track('instagram_click'));
$('map').addEventListener('click', () => track('map_click'));

/* ---------- wire up ---------- */
$('startBtn').addEventListener('click', onStart);
$('sendBtn').addEventListener('click', onSubmit);
$('phoneBtn').addEventListener('click', onPhone);
$('tel').addEventListener('keydown', e => { if (e.key === 'Enter') onPhone(); });
addEventListener('resize', () => { if (phase === 'intro') gsap.set('#brand', { clearProps: 'x,y' }); });

if (document.fonts && document.fonts.ready) document.fonts.ready.then(intro); else intro();
