# TAMUR — Open the Safe

Static site (Render) + Supabase Edge Function `safe-api`. No build step.

## Files
| Path | Role |
|---|---|
| `index.html` | Markup and design system (fonts, colours, layout, glass panel, finale) |
| `js/app.js` | Scene direction (GSAP), game flow, Supabase calls, analytics queue, controls |
| `js/vault3d.js` | Procedural Three.js vault: PBR titanium + champagne gold, dial, gears, bolts, 3D digit drums, camera rig |
| `js/sfx.js` | Mechanical sound design synthesised with WebAudio (no audio files) |
| `vendor/` | Three.js r170 (+ RoomEnvironment, RoundedBoxGeometry) and GSAP 3.12.5, self-hosted |
| `fonts/` | Cormorant Garamond + Poppins (woff2, self-hosted) |
| `tamur-logo-mark.png` | Transparent cut of `tamur-logo.jpg`, used for the gold logo and the 3D engravings |

## Server contract (unchanged)
`POST safe-api` with `{ action, deviceId, ...extra }`:
- `start` → `{ attempts, needsPhone, finished }` or `{ testMode: true }`
- `attempt` + `code` → `{ attempts, needsPhone, finished }`
- `phone` + `phone` (`+998XXXXXXXXX`) → `{ finished }`
- `event` + `name, ts, utm, ref` — analytics; sent **only** after `start` confirms the live campaign.

The correct code never reaches the browser and the vault animation is identical for every result.

## Test mode
While `safe_private_config.accepting_entries = false` the server answers `{ testMode: true }`.
The browser then sends **nothing else**: attempts and phone numbers stay local, analytics are dropped.
A small "Test rejimi" tag is shown.

## Fallbacks
- No WebGL → 2D code drums (same flow).
- `prefers-reduced-motion` → no camera moves or door swing; short cross-fades.
- Weak GPU → pixel ratio steps down automatically to keep frame rate.
