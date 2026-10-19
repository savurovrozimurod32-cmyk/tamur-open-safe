// Live check of https://tamur-open-safe.onrender.com — runs on GitHub Actions.
// Safety: only the `start` call may reach Supabase; attempt/phone/event are aborted by the test,
// and the run stops if the server reports a live (non-test) campaign.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'fs';

const SITE = 'https://tamur-open-safe.onrender.com';
const API = 'https://eahpfrvevrwyoqkpysqp.supabase.co/functions/v1/safe-api';
const OUT = 'results'; mkdirSync(OUT, { recursive: true });
const REPORT = `${OUT}/report.md`; writeFileSync(REPORT, `# Live check — ${new Date().toISOString()}\n\n`);
const R = s => { appendFileSync(REPORT, s + '\n'); console.log(s); };

/* ---------- 1. deployment + assets ---------- */
R('## 1. Render deployment');
// wait for Render to publish the latest main (the new attempts counter has id="anum")
let res, html = '';
for (let k = 0; k < 40; k++) {
  res = await fetch(SITE + '/?v=' + Date.now(), { headers: { 'accept-encoding': 'gzip, br', 'cache-control': 'no-cache' } });
  html = await res.text();
  if (html.includes('user-scalable=no')) break;
  await new Promise(r => setTimeout(r, 15000));
}
R(`- Latest build (zoom lock) is live: **${html.includes('user-scalable=no') ? 'YES' : 'NO'}**`);
R(`- GET / → **${res.status}**, server: ${res.headers.get('server')}, encoding: ${res.headers.get('content-encoding') || 'none'}`);
R(`- Deployed build is the 3D version (references js/app.js): **${html.includes('js/app.js') ? 'YES' : 'NO'}**`);
const assets = ['js/app.js', 'js/vault3d.js', 'js/sfx.js', 'vendor/three.module.min.js', 'vendor/gsap.min.js', 'vendor/RoomEnvironment.js',
  'vendor/RoundedBoxGeometry.js', 'fonts/cormorant-garamond-latin-500-normal.woff2', 'fonts/poppins-latin-400-normal.woff2',
  'tamur-logo-mark.png', 'tamur-store.jpg', 'tamur-logo.jpg'];
for (const a of assets) {
  const t = performance.now(); const r = await fetch(`${SITE}/${a}`, { headers: { 'accept-encoding': 'gzip, br' } }); const b = await r.arrayBuffer();
  R(`- ${a} → ${r.status}, ${r.headers.get('content-type')}, ${(b.byteLength / 1024).toFixed(0)} KB transferred-decoded, ${r.headers.get('content-encoding') || 'no compression'}, ${(performance.now() - t).toFixed(0)} ms`);
}
const v = await fetch(`${SITE}/TAMUR_video_GitHub.mp4`, { headers: { range: 'bytes=0-1023' } });
R(`- TAMUR_video_GitHub.mp4 (range request) → ${v.status}, ${v.headers.get('content-type')}, content-range: ${v.headers.get('content-range')}`);
await v.arrayBuffer();

/* ---------- 2. Supabase (start only) ---------- */
R('\n## 2. Supabase safe-api');
const pre = await fetch(API, { method: 'OPTIONS', headers: { origin: SITE, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
R(`- CORS preflight → ${pre.status}, allow-origin: ${pre.headers.get('access-control-allow-origin')}`);
const deviceId = 'ci-live-check-' + (process.env.GITHUB_RUN_ID || Date.now());
const st = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE }, body: JSON.stringify({ action: 'start', deviceId }) });
const stBody = await st.text();
R(`- start → ${st.status}: \`${stBody.slice(0, 300)}\``);
let testMode = false; try { testMode = !!JSON.parse(stBody).testMode; } catch (e) { /* ignore */ }
R(`- Test mode active: **${testMode ? 'YES' : 'NO'}**`);
if (!testMode) { R('\n**STOP:** server is not in test mode — browser flow skipped to avoid writing real data.'); process.exit(0); }

/* ---------- 3. Browser flow on the live site ---------- */
async function flow(tag, viewport, mobile) {
  R(`\n## 3${tag}. Browser flow — ${viewport.width}×${viewport.height}${mobile ? ' (mobile)' : ''}`);
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], calls = [], blocked = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/functions/v1/safe-api', route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (route.request().method() !== 'POST') return route.continue();
    if (b.action === 'start') { calls.push('start'); return route.continue(); }
    blocked.push(b.action + (b.name ? ':' + b.name : '')); return route.abort();
  });
  const shot = n => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  const ev = f => page.evaluate(f);
  const until = async (fn, max = 240) => { for (let k = 0; k < max; k++) { await page.waitForTimeout(1000); if (await ev(fn)) return true; } return false; };
  const t0 = Date.now();
  await page.goto(SITE, { waitUntil: 'load' });
  R(`- load event: ${Date.now() - t0} ms`);
  const webgl = await ev(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
  R(`- WebGL in this browser: ${webgl}`);
  await ev(() => { gsap.ticker.lagSmoothing(0); });
  await page.waitForTimeout(2500); await shot('01-intro-early');
  const introOk = await until(() => getComputedStyle(document.getElementById('startBtn')).pointerEvents === 'auto');
  R(`- intro finished, button ready: ${introOk} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await page.waitForTimeout(1500); await shot('02-intro');
  await page.click('#startBtn');
  const gameOk = await until(() => !document.getElementById('gameUI').hidden && !document.getElementById('sendBtn').disabled);
  R(`- game screen ready: ${gameOk}; test tag visible: ${await ev(() => !document.getElementById('testTag').hidden)}; attempts counter: "${await ev(() => document.getElementById('attempts').innerText.replace(/\s+/g, ' '))}"`);
  await page.waitForTimeout(2000); await shot('03-game');
  const target = [1, 0, 2, 4, 8];
  for (let i = 0; i < 5; i++) {
    const n = target[i], up = n <= 5, steps = up ? n : 10 - n;
    for (let k = 0; k < steps; k++) { await page.click(`#controls .ar:nth-of-type(${i * 2 + (up ? 1 : 2)})`); await page.waitForTimeout(150); }
  }
  await page.waitForTimeout(2000);
  R(`- digits entered: ${JSON.stringify(await ev(() => window.__digits()))} (expected ${JSON.stringify(target)})`);
  await shot('04-code');
  await page.click('#sendBtn');
  await page.waitForTimeout(2200); await shot('05-door');
  const phoneOk = await until(() => !document.getElementById('phoneUI').hidden);
  R(`- phone panel after 1st attempt: ${phoneOk}`);
  await page.waitForTimeout(1500); await shot('06-phone');
  await page.fill('#tel', '901234567'); await page.click('.consent');
  await page.click('#phoneBtn');
  const promoOk = await until(() => !document.getElementById('promo').hidden);
  await until(() => +getComputedStyle(document.querySelector('#pAct > *')).opacity > 0.95, 30);
  await page.waitForTimeout(1000); await shot('06b-promo');
  const promo = await ev(() => { const v = document.getElementById('promoVideo'); return {
    title: document.getElementById('promoTitle').textContent.replace(/\s+/g, ' ').trim(),
    left: document.getElementById('pLeft').innerText.replace(/\s+/g, ' ').trim(),
    msg: document.getElementById('pMsg').textContent.replace(/\s+/g, ' ').trim(),
    insta: document.getElementById('pInsta').href, video: { paused: v.paused, muted: v.muted, w: v.videoWidth, h: v.videoHeight } }; });
  R(`- promo scene after phone: ${promoOk} — ${JSON.stringify(promo)}`);
  await page.click('#pNext');
  const g2 = await until(() => !document.getElementById('gameUI').hidden && !document.getElementById('sendBtn').disabled);
  await page.click('#sendBtn');
  const g3 = await until(() => !document.getElementById('gameUI').hidden && !document.getElementById('sendBtn').disabled);
  R(`- attempt 2 → back to game: ${g2}; attempt 3 ready: ${g3}; pips used: ${await ev(() => document.querySelectorAll('.pip.used').length)}`);
  await page.click('#sendBtn');
  const fin = await until(() => !document.getElementById('finale').hidden);
  await page.waitForTimeout(5000);
  const vid = await ev(() => { const v = document.getElementById('finalVideo'); return { paused: v.paused, muted: v.muted, time: +v.currentTime.toFixed(1), w: v.videoWidth, h: v.videoHeight, err: v.error && v.error.code }; });
  R(`- finale shown: ${fin}; video: ${JSON.stringify(vid)}`);
  const links = await ev(() => [...document.querySelectorAll('#links a')].map(a => `${a.textContent.trim()} → ${a.href} (target=${a.target})`));
  links.forEach(l => R(`- link: ${l}`));
  await shot('07-finale');
  R(`- Supabase calls that went out: ${calls.join(', ') || 'none'}`);
  R(`- Calls the page tried beyond start (blocked by the test): ${blocked.join(', ') || 'none ✅'}`);
  R(`- Page errors: ${errors.length ? errors.map(e => '`' + e.slice(0, 160) + '`').join('; ') : 'none ✅'}`);
  R(`- Total: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await browser.close();
}
await flow('m', { width: 390, height: 844 }, true);
await flow('d', { width: 1440, height: 900 }, false);
R('\nDONE');
