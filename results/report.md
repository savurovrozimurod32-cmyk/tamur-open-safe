# Live check — 2026-10-18T04:59:05.948Z

## 1. Render deployment
- Latest build (attempts counter) is live: **YES**
- GET / → **200**, server: cloudflare, encoding: br
- Deployed build is the 3D version (references js/app.js): **YES**
- js/app.js → 200, application/javascript, 25 KB transferred-decoded, br, 160 ms
- js/vault3d.js → 200, application/javascript, 38 KB transferred-decoded, br, 167 ms
- js/sfx.js → 200, application/javascript, 5 KB transferred-decoded, br, 154 ms
- vendor/three.module.min.js → 200, application/javascript, 675 KB transferred-decoded, br, 212 ms
- vendor/gsap.min.js → 200, application/javascript, 71 KB transferred-decoded, br, 109 ms
- vendor/RoomEnvironment.js → 200, application/javascript, 4 KB transferred-decoded, br, 159 ms
- vendor/RoundedBoxGeometry.js → 200, application/javascript, 5 KB transferred-decoded, br, 175 ms
- fonts/cormorant-garamond-latin-500-normal.woff2 → 200, font/woff2, 23 KB transferred-decoded, no compression, 168 ms
- fonts/poppins-latin-400-normal.woff2 → 200, font/woff2, 8 KB transferred-decoded, no compression, 237 ms
- tamur-logo-mark.png → 200, image/png, 16 KB transferred-decoded, no compression, 176 ms
- tamur-store.jpg → 200, image/jpeg, 217 KB transferred-decoded, no compression, 189 ms
- tamur-logo.jpg → 200, image/jpeg, 15 KB transferred-decoded, no compression, 145 ms
- TAMUR_video_GitHub.mp4 (range request) → 206, video/mp4, content-range: bytes 0-1023/17593533

## 2. Supabase safe-api
- CORS preflight → 200, allow-origin: https://tamur-open-safe.onrender.com
- start → 200: `{"testMode":true,"attempts":0,"needsPhone":false,"finished":false}`
- Test mode active: **YES**

## 3m. Browser flow — 390×844 (mobile)
- load event: 1205 ms
- WebGL in this browser: true
- intro finished, button ready: true (10.2 s)
- game screen ready: true; test tag visible: true; attempts counter: "QOLGAN URINISHLAR 3/3"
- digits entered: [1,0,2,4,8] (expected [1,0,2,4,8])
- phone panel after 1st attempt: true
- attempt 2 → back to game: true; attempt 3 ready: true; pips used: 2
- finale shown: true; video: {"paused":false,"muted":false,"time":5.5,"w":720,"h":1280,"err":null}
- link: Instagram → https://www.instagram.com/tamur_terakzor/ (target=_blank)
- link: Manzil → https://maps.app.goo.gl/CimVDXb1XPi7Q7X59 (target=_blank)
- Supabase calls that went out: start
- Calls the page tried beyond start (blocked by the test): none ✅
- Page errors: none ✅
- Total: 153 s

## 3d. Browser flow — 1440×900
- load event: 239 ms
- WebGL in this browser: true
- intro finished, button ready: true (8.9 s)
- game screen ready: true; test tag visible: true; attempts counter: "QOLGAN URINISHLAR 3/3"
- digits entered: [1,0,2,4,8] (expected [1,0,2,4,8])
- phone panel after 1st attempt: true
- attempt 2 → back to game: true; attempt 3 ready: true; pips used: 2
- finale shown: true; video: {"paused":false,"muted":false,"time":5,"w":720,"h":1280,"err":null}
- link: Instagram → https://www.instagram.com/tamur_terakzor/ (target=_blank)
- link: Manzil → https://maps.app.goo.gl/CimVDXb1XPi7Q7X59 (target=_blank)
- Supabase calls that went out: start
- Calls the page tried beyond start (blocked by the test): none ✅
- Page errors: none ✅
- Total: 366 s

DONE
