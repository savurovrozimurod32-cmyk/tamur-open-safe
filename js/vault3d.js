// TAMUR — 3D vault (Three.js). Fully procedural: no external model files.
import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const gsap = window.gsap;
const TAU = Math.PI * 2, DEG = Math.PI / 180;

/* ---------- dimensions (world units) ---------- */
const BODY_W = 2.96, BODY_H = 3.3, BODY_D = 1.8;
const OPEN_W = 2.46, OPEN_H = 2.84, FRAME_D = 0.36;
const DOOR_W = 2.42, DOOR_H = 2.8, DOOR_D = 0.32, DOOR_FRONT = 0.02;
const PANEL_W = 2.26, PANEL_H = 2.62, PANEL_D = 0.045;
const DIAL_Y = 0.36, SLOT_Y = -0.8, SLOT_W = 1.78, SLOT_H = 0.27;
const DRUM_R = 0.26, DRUM_L = 0.25, DRUM_GAP = 0.32;
const DRUM_Z = -0.205, DRUM_Z_HIDDEN = -0.33;   // front of an active drum sits just proud of the panel
const HINGE_X = DOOR_W / 2 + 0.01;

/* ---------- helpers ---------- */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

function rrShape(w, h, r, cx = 0, cy = 0, Ctor = THREE.Shape) {
  const s = new Ctor(), x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function ringShape(ow, oh, or, iw, ih, ir) {
  const s = rrShape(ow, oh, or); s.holes.push(rrShape(iw, ih, ir, 0, 0, THREE.Path)); return s;
}
function extrude(shape, depth, bevel = 0.008, seg = 3) {
  return new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments: 24, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg,
  });
}
function gearShape(R, teeth, toothDepth, holeR) {
  const s = new THREE.Shape(), step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step, rr = R - toothDepth;
    const pts = [[a, rr], [a + step * 0.18, R], [a + step * 0.48, R], [a + step * 0.66, rr]];
    pts.forEach(([ang, r], k) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, holeR, 0, TAU, true); s.holes.push(hole);
  return s;
}

/* ---------- procedural textures ---------- */
function brushedTexture() {
  const S = 512, [c, g] = makeCanvas(S, S);
  g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3200; i++) {
    const y = Math.random() * S, x = Math.random() * S - 100, l = 60 + Math.random() * 380, v = (105 + Math.random() * 90) | 0;
    g.strokeStyle = `rgba(${v},${v},${v},${0.18 + Math.random() * 0.35})`;
    g.lineWidth = 0.3 + Math.random() * 1.1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (Math.random() - 0.5)); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function sunburstTexture() {
  const S = 512, [c, g] = makeCanvas(S, S);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, S); g.translate(S / 2, S / 2);
  for (let i = 0; i < 1600; i++) {
    const a = Math.random() * TAU, v = (80 + Math.random() * 110) | 0;
    g.strokeStyle = `rgba(${v},${v},${v},.32)`; g.lineWidth = 0.5 + Math.random();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * S, Math.sin(a) * S); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}
function radialTexture(stops) {
  const S = 256, [c, g] = makeCanvas(S, S);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function digitTextures() {
  // u (canvas x) runs around the drum, v (canvas y) runs along it. Digit k sits at u = -k/10,
  // glyphs rotated 90° so they read upright once the drum's axis is horizontal.
  const W = 1024, H = 256, slot = W / 10;
  const [c, g] = makeCanvas(W, H), [e, ge] = makeCanvas(W, H);
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#2c2926'); base.addColorStop(0.5, '#1c1a18'); base.addColorStop(1, '#2c2926');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const v = (30 + Math.random() * 30) | 0; g.fillStyle = `rgba(${v + 10},${v + 6},${v},.35)`;
    g.fillRect(Math.random() * W, Math.random() * H, 20 + Math.random() * 120, 1);
  }
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  // gold rims at both ends of the drum
  g.fillStyle = '#c2a06a'; g.fillRect(0, 0, W, 9); g.fillRect(0, H - 9, W, 9);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 9, W, 2); g.fillRect(0, H - 11, W, 2);
  const font = '500 84px Poppins, "Helvetica Neue", Arial, sans-serif';
  const sx = (H / DRUM_L) / (W / (TAU * DRUM_R));   // keep true glyph proportions on the cylinder
  for (let k = 0; k < 10; k++) {
    const u0 = ((10 - k) % 10) * slot;
    for (const u of [u0, u0 + W]) {
      // engraved separators between digits
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(u - slot / 2 - 1, 22, 2, H - 44);
      g.fillStyle = 'rgba(214,185,140,.18)'; g.fillRect(u - slot / 2 + 1, 22, 1, H - 44);
      for (const [ctx, col] of [[g, '#e8c992'], [ge, '#ffffff']]) {
        ctx.save(); ctx.translate(u, H / 2); ctx.rotate(Math.PI / 2); ctx.scale(sx, 1);
        ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = col;
        const m = ctx.measureText(String(k));
        ctx.fillText(String(k), 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
        ctx.restore();
      }
    }
  }
  const map = new THREE.CanvasTexture(c), emap = new THREE.CanvasTexture(e);
  for (const t of [map, emap]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
  return { map, emap };
}
function logoTextures(img) {
  // the logo PNG is a white mark on transparency: split into the "T" emblem and the wordmark
  const out = {};
  const parts = { mark: [0, 0.585], word: [0.68, 1] };
  for (const [k, [a, b]] of Object.entries(parts)) {
    const sy = Math.round(img.height * a), sh = Math.round(img.height * (b - a));
    const [c, g] = makeCanvas(img.width, sh);
    g.drawImage(img, 0, sy, img.width, sh, 0, 0, img.width, sh);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
    out[k] = { tex: t, aspect: img.width / sh };
  }
  return out;
}

/* =================================================================== */
export async function createVault(canvas, opts = {}) {
  const reduced = !!opts.reduced;
  const sfx = opts.sfx || {};
  const haptic = opts.haptic || (() => {});
  const S = (name, ...a) => { try { sfx[name] && sfx[name](...a); } catch (e) { /* audio is optional */ } };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('webgl');
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0;            // ramps up in the reveal
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
  const tanH = Math.tan(camera.fov * DEG / 2);

  /* ---------- fonts & logo for textures ---------- */
  try { await document.fonts.load('500 96px Poppins'); } catch (e) { /* fallback font is fine */ }
  const logoImg = await new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = opts.logoSrc || 'tamur-logo-mark.png';
  });

  /* ---------- materials ---------- */
  const brushed = brushedTexture(), brushedFine = brushed.clone(); brushedFine.repeat.set(3, 3); brushedFine.needsUpdate = true;
  const sunburst = sunburstTexture();
  const titanium = new THREE.MeshPhysicalMaterial({
    color: 0x2a2826, metalness: 1, roughness: 0.62, roughnessMap: brushed,
    clearcoat: 0.35, clearcoatRoughness: 0.28,
  });
  const titaniumPanel = new THREE.MeshPhysicalMaterial({
    color: 0x34312d, metalness: 1, roughness: 0.55, roughnessMap: brushedFine,
    clearcoat: 0.5, clearcoatRoughness: 0.2,
  });
  const titaniumDark = new THREE.MeshPhysicalMaterial({ color: 0x151413, metalness: 0.9, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xe2c18c, metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.08 });
  const goldBrushed = new THREE.MeshPhysicalMaterial({ color: 0xcfae78, metalness: 1, roughness: 0.55, roughnessMap: brushedFine, clearcoat: 0.3, clearcoatRoughness: 0.2 });
  const goldDark = new THREE.MeshPhysicalMaterial({ color: 0xa88954, metalness: 1, roughness: 0.38 });
  const dialMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3632, metalness: 1, roughness: 0.6, roughnessMap: sunburst, clearcoat: 0.9, clearcoatRoughness: 0.05 });
  const black = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.85, metalness: 0.1 });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x1a140c, emissive: 0xffc982, emissiveIntensity: 0 });
  const plinthMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0a, metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const allMetal = [titanium, titaniumPanel, titaniumDark, gold, goldBrushed, goldDark, dialMat, plinthMat];

  /* ---------- scene graph ---------- */
  const safe = new THREE.Group(); scene.add(safe);

  // body + thick front frame (the hole is the vault opening)
  const body = new THREE.Mesh(new RoundedBoxGeometry(BODY_W, BODY_H, BODY_D, 4, 0.14), titanium);
  body.position.z = -FRAME_D + 0.14 - BODY_D / 2; safe.add(body);
  const frameGeo = extrude(ringShape(BODY_W - 0.04, BODY_H - 0.04, 0.12, OPEN_W + 0.02, OPEN_H + 0.02, 0.08), FRAME_D - 0.03, 0.015);
  const frame = new THREE.Mesh(frameGeo, titanium); frame.position.z = -FRAME_D + 0.015; safe.add(frame);
  const trim = new THREE.Mesh(extrude(ringShape(OPEN_W + 0.12, OPEN_H + 0.12, 0.1, OPEN_W + 0.01, OPEN_H + 0.01, 0.075), 0.012, 0.006), gold);
  trim.position.z = 0.0; safe.add(trim);
  // hairline gold inlay around the outer front edge
  const inlay = new THREE.Mesh(extrude(ringShape(BODY_W - 0.14, BODY_H - 0.14, 0.09, BODY_W - 0.17, BODY_H - 0.17, 0.08), 0.004, 0.002, 1), goldBrushed);
  inlay.position.z = 0.0; safe.add(inlay);

  // vault interior (seen when the door swings): glowing back wall + light
  const glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,240,215,.6)'], [0.7, 'rgba(255,220,170,.12)'], [1, 'rgba(255,220,170,0)']]);
  const backWallMat = new THREE.MeshStandardMaterial({ color: 0x1b1611, roughness: 0.55, metalness: 0.7, emissive: 0xffc480, emissiveMap: glowTex, emissiveIntensity: 0 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(OPEN_W, OPEN_H), backWallMat);
  backWall.position.z = -FRAME_D + 0.02; safe.add(backWall);
  const innerLight = new THREE.PointLight(0xffc77d, 0, 7, 2); innerLight.position.set(-0.4, 0.1, -0.12); safe.add(innerLight);
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a3, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glowSprite.position.set(-1.05, 0, 0.35); glowSprite.scale.set(0.1, 0.1, 1); safe.add(glowSprite);

  // plinth + contact shadow
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(3.34, 0.16, 2.3, 3, 0.05), plinthMat);
  plinth.position.set(0, -BODY_H / 2 - 0.08, -FRAME_D - 0.62); safe.add(plinth);
  const plinthLine = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.008, 0.008), gold);
  plinthLine.position.set(0, -BODY_H / 2 - 0.035, plinth.position.z + 1.152); safe.add(plinthLine);
  const shadowTex = radialTexture([[0, 'rgba(0,0,0,.85)'], [0.45, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -BODY_H / 2 - 0.165, -0.8); safe.add(shadow);

  // hinges
  for (const y of [-0.92, 0.92]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.46, 32), gold);
    h.position.set(HINGE_X + 0.035, y, 0.05); safe.add(h);
    for (const dy of [-0.245, 0.245]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), gold); cap.position.set(HINGE_X + 0.035, y + dy, 0.05); cap.scale.y = 0.45; safe.add(cap);
    }
  }

  /* ---------- the door ---------- */
  const doorPivot = new THREE.Group(); doorPivot.position.set(HINGE_X, 0, 0); safe.add(doorPivot);
  const door = new THREE.Group(); door.position.x = -HINGE_X; doorPivot.add(door);   // door-local origin = centre of the door face
  const doorBody = new THREE.Mesh(new RoundedBoxGeometry(DOOR_W, DOOR_H, DOOR_D, 3, 0.04), titanium);
  doorBody.position.z = DOOR_FRONT - DOOR_D / 2; door.add(doorBody);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.006, DOOR_H - 0.12, DOOR_D - 0.08), gold);
  edge.position.set(-DOOR_W / 2 - 0.002, 0, DOOR_FRONT - DOOR_D / 2); door.add(edge);
  // real locking bolts on the door edge (they sit inside the frame while closed)
  const edgeBolts = [];
  for (const y of [-0.85, 0, 0.85]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.32, 28), gold);
    b.rotation.z = Math.PI / 2; b.position.set(-DOOR_W / 2 - 0.1, y, DOOR_FRONT - DOOR_D / 2); door.add(b); edgeBolts.push(b);
  }

  const face = new THREE.Group(); face.position.z = DOOR_FRONT; door.add(face);
  const panelShape = rrShape(PANEL_W, PANEL_H, 0.1);
  panelShape.holes.push(rrShape(SLOT_W, SLOT_H, 0.04, 0, SLOT_Y, THREE.Path));
  const panel = new THREE.Mesh(extrude(panelShape, PANEL_D - 0.01, 0.005, 2), titaniumPanel); face.add(panel);
  const panelBorder = new THREE.Mesh(extrude(ringShape(PANEL_W + 0.012, PANEL_H + 0.012, 0.105, PANEL_W - 0.03, PANEL_H - 0.03, 0.09), PANEL_D, 0.004, 2), gold);
  face.add(panelBorder);

  // rivets
  {
    const pts = [], inset = 0.075, hw = PANEL_W / 2 - inset, hh = PANEL_H / 2 - inset;
    for (let i = 0; i <= 10; i++) { const x = -hw + (2 * hw * i) / 10; pts.push([x, hh], [x, -hh]); }
    for (let i = 1; i < 12; i++) { const y = -hh + (2 * hh * i) / 12; pts.push([hw, y], [-hw, y]); }
    const rv = new THREE.InstancedMesh(new THREE.SphereGeometry(0.021, 16, 10), gold, pts.length);
    const m = new THREE.Matrix4();
    pts.forEach(([x, y], i) => { m.makeTranslation(x, y, PANEL_D + 0.004); rv.setMatrixAt(i, m); });
    face.add(rv);
  }

  // dial assembly
  const dialBase = new THREE.Group(); dialBase.position.set(0, DIAL_Y, PANEL_D); face.add(dialBase);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.042, 24, 128), gold); bezel.position.z = 0.05; dialBase.add(bezel);
  const bezelSeat = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.012, 12, 128), goldDark); bezelSeat.position.z = 0.01; dialBase.add(bezelSeat);
  const ringGear = new THREE.Mesh(extrude(gearShape(0.605, 56, 0.032, 0.43), 0.026, 0.004, 1), goldBrushed);
  ringGear.position.z = 0.0; dialBase.add(ringGear);
  const index = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 3), gold);
  index.rotation.z = Math.PI; index.position.set(0, 0.735, 0.04); dialBase.add(index);

  const dial = new THREE.Group(); dial.position.z = 0.03; dialBase.add(dial);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.07, 128, 1), [titaniumDark, dialMat, dialMat]);
  disc.rotation.x = Math.PI / 2; disc.position.z = 0.035; dial.add(disc);
  {
    const N = 120, knurl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.011, 0.016, 0.066), titanium, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU; p.set(Math.cos(a) * 0.524, Math.sin(a) * 0.524, 0.035);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a); m.compose(p, q, s); knurl.setMatrixAt(i, m);
    }
    dial.add(knurl);
    const T = 60, ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.006), gold, T);
    for (let i = 0; i < T; i++) {
      const a = (i / T) * TAU, long = i % 5 === 0, len = long ? 0.06 : 0.03, r = 0.47 - len / 2;
      p.set(Math.cos(a) * r, Math.sin(a) * r, 0.072);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + Math.PI / 2);
      m.compose(p, q, new THREE.Vector3(long ? 0.007 : 0.004, len, 1)); ticks.setMatrixAt(i, m);
    }
    dial.add(ticks);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.07, 64), gold);
  hub.rotation.x = Math.PI / 2; hub.position.z = 0.105; dial.add(hub);
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + k * (TAU / 3), arm = new THREE.Group(); arm.rotation.z = a - Math.PI / 2; dial.add(arm);
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.34, 20), gold);
    spoke.position.set(0, 0.31, 0.12); arm.add(spoke);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.058, 32, 20), gold); knob.position.set(0, 0.5, 0.12); arm.add(knob);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 10, 24), goldDark); collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.155, 0.12); arm.add(collar);
  }

  // logo engravings
  let wordPlate = null;
  if (logoImg) {
    const lt = logoTextures(logoImg);
    // the PNG is a white mark on transparency: use it as the colour map (alpha from it) and tint via colour
    const engraved = new THREE.MeshPhysicalMaterial({ color: 0x16120e, metalness: 0.9, roughness: 0.35, map: lt.mark.tex, transparent: true, alphaTest: 0.4 });
    const capH = 0.15, mark = new THREE.Mesh(new THREE.PlaneGeometry(capH * lt.mark.aspect, capH), engraved);
    mark.position.z = 0.142; dial.add(mark);
    const wordMat = new THREE.MeshPhysicalMaterial({ color: 0xe0c08b, metalness: 1, roughness: 0.25, map: lt.word.tex, transparent: true, alphaTest: 0.02 });
    const wh = 0.085; wordPlate = new THREE.Mesh(new THREE.PlaneGeometry(wh * lt.word.aspect, wh), wordMat);
    wordPlate.position.set(0, SLOT_Y - 0.37, PANEL_D + 0.002); face.add(wordPlate);
    // the textures carry their own white colour; tint through material colour
    [engraved, wordMat].forEach(mt => { mt.map.colorSpace = THREE.SRGBColorSpace; });
  }

  // complication gears in the upper corners
  const smallGears = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * 0.88, DIAL_Y + 0.74, PANEL_D); face.add(g);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 48), black); well.rotation.x = Math.PI / 2; well.position.z = 0.002; g.add(well);
    const gr = new THREE.Mesh(extrude(gearShape(0.125, 18, 0.024, 0.03), 0.018, 0.003, 1), goldBrushed); gr.position.z = 0.006; g.add(gr);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 10), gold); pin.position.z = 0.03; g.add(pin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.014, 12, 64), gold); rim.position.z = 0.012; g.add(rim);
    smallGears.push({ mesh: gr, dir: -sx });
  }

  // exposed bolt mechanism on both sides of the dial
  const faceBolts = [];
  for (const sx of [-1, 1]) {
    for (const dy of [-0.42, 0, 0.42]) {
      const y = DIAL_Y + dy, x = sx * 0.94;
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.012), black); ch.position.set(x, y, PANEL_D + 0.001); face.add(ch);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 20), gold);
      rod.rotation.z = Math.PI / 2; rod.position.set(x + sx * 0.04, y, PANEL_D + 0.014); face.add(rod);
      const capA = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), gold); capA.position.set(0, 0.1, 0); rod.add(capA);
      const capB = capA.clone(); capB.position.y = -0.1; rod.add(capB);
      faceBolts.push({ rod, sx, x0: rod.position.x });
    }
  }

  // code window: slot, frame, LEDs, shutters, drums
  const slotBack = new THREE.Mesh(new THREE.PlaneGeometry(SLOT_W, SLOT_H), black); slotBack.position.set(0, SLOT_Y, 0.004); face.add(slotBack);
  const slotFrame = new THREE.Mesh(extrude(ringShape(SLOT_W + 0.1, SLOT_H + 0.1, 0.07, SLOT_W, SLOT_H, 0.04), 0.016, 0.005, 2), gold);
  slotFrame.position.set(0, SLOT_Y, PANEL_D); face.add(slotFrame);
  const leds = [];
  for (const sy of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(SLOT_W - 0.08, 0.006, 0.006), ledMat);
    l.position.set(0, SLOT_Y + sy * (SLOT_H / 2 - 0.012), PANEL_D - 0.012); face.add(l); leds.push(l);
  }
  const shutters = [];
  for (const sy of [1, -1]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(SLOT_W + 0.04, SLOT_H / 2 + 0.012, 0.012), titaniumPanel);
    sh.position.set(0, SLOT_Y + sy * (SLOT_H / 4), 0.028); face.add(sh);
    const groove = new THREE.Mesh(new THREE.BoxGeometry(SLOT_W, 0.004, 0.002), goldDark);
    groove.position.set(0, -sy * (SLOT_H / 4 - 0.006), 0.007); sh.add(groove);
    shutters.push({ mesh: sh, sy, y0: sh.position.y });
  }
  const { map: digitMap, emap: digitEmap } = digitTextures();
  const drums = [];
  const capMat = goldBrushed;
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshPhysicalMaterial({
      map: digitMap, emissiveMap: digitEmap, emissive: 0xffc27a, emissiveIntensity: 0,
      metalness: 0.35, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.1,
    });
    const roll = new THREE.Group(); roll.position.set((i - 2) * DRUM_GAP, SLOT_Y, DRUM_Z_HIDDEN); face.add(roll);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R, DRUM_R, DRUM_L, 72, 1), [mat, capMat, capMat]);
    mesh.rotation.z = Math.PI / 2; roll.add(mesh);
    drums.push({ roll, mat, val: 0, tween: null });
  }
  // depth shading over the code window: the drums read as curved cylinders sunk into the door
  {
    const [c, g] = makeCanvas(8, 128), gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(0,0,0,.92)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.92)');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(SLOT_W, SLOT_H), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    shade.position.set(0, SLOT_Y, DRUM_Z + DRUM_R + 0.004); shade.renderOrder = 2; face.add(shade);
  }

  /* ---------- lights ---------- */
  const amb = new THREE.AmbientLight(0xfff3e0, 0.0); scene.add(amb);
  const key = new THREE.DirectionalLight(0xfff0dc, 0); key.position.set(-4.5, 6, 7.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffcb85, 0); rim.position.set(6, 3.5, -5); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffd9a8, 0); rim2.position.set(-6, 1.5, -4); scene.add(rim2);
  const fill = new THREE.DirectionalLight(0xdfe4ff, 0); fill.position.set(3, -2, 6); scene.add(fill);
  const sweep = new THREE.PointLight(0xfff1dc, 0, 9, 2); sweep.position.set(-4, 1.2, 2.4); scene.add(sweep);
  const LIGHTS_ON = { amb: 0.12, key: 2.3, rim: 2.6, rim2: 1.1, fill: 0.35, env: 0.85 };

  /* ---------- camera rig & framing ---------- */
  const rig = { dist: 40, tx: 0, ty: 0, tz: 0, az: 22 * DEG, el: 9 * DEG };
  let sway = 0;                 // idle camera breathing amount (0..1)
  let stateName = 'far';
  let W = 1, H = 1;

  function fit(w, h) { return Math.max(h / (2 * tanH), w / (2 * tanH * camera.aspect)); }
  function framing(state) {
    const a = camera.aspect, wide = a > 1.15;
    // subject point P appears at screen fraction (fx, fy)
    const make = (dist, px, py, fx, fy, az = 0, el = 3 * DEG) => {
      const vh = 2 * dist * tanH, vw = vh * a;
      return { dist, tx: px - (fx - 0.5) * vw, ty: py + (fy - 0.5) * vh, tz: 0, az, el };
    };
    if (state === 'intro' || state === 'far') {
      const f = wide ? make(fit(3.6 / 0.42, 3.7 / 0.62), 0, -0.05, 0.69, 0.52)
                     : make(fit(3.2 / 0.8, 3.6 / 0.41), 0, -0.05, 0.5, 0.5);
      if (state === 'far') { f.dist *= 2.7; f.az = 24 * DEG; f.el = 10 * DEG; f.ty += 0.6; }
      else f.az = 0;
      return f;
    }
    if (state === 'game' || state === 'phone') {
      const midY = (DIAL_Y + SLOT_Y) / 2;
      return wide ? make(fit(2.0 / 0.4, 2.3 / 0.74), 0, midY + 0.04, 0.66, 0.5, -4 * DEG, 2 * DEG)
                  : make(fit(2.2 / 0.94, 3.2 / 0.62), 0, 0, 0.5, 0.47, 0, 2 * DEG);
    }
    if (state === 'lock') {
      const f = framing('game'); f.dist *= 0.86; f.ty += 0.08; return f;
    }
    return framing('intro');
  }
  function applyCamera(t) {
    const swA = sway * Math.sin(t * 0.33) * 1.4 * DEG, swE = sway * Math.sin(t * 0.21 + 1.3) * 0.7 * DEG;
    const az = rig.az + swA, el = rig.el + swE, ce = Math.cos(el);
    camera.position.set(rig.tx + rig.dist * Math.sin(az) * ce, rig.ty + rig.dist * Math.sin(el), rig.tz + rig.dist * Math.cos(az) * ce);
    camera.lookAt(rig.tx, rig.ty, rig.tz);
  }
  function snapTo(state) { stateName = state; Object.assign(rig, framing(state)); }
  function camTo(tl, state, duration, ease, pos) {
    stateName = state;
    const f = framing(state);
    if (reduced) tl.set(rig, f, pos); else tl.to(rig, { ...f, duration, ease }, pos);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!gsap.isTweening(rig)) snapTo(stateName);
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  snapTo('far');

  /* ---------- pre-compile all shaders off the main path (KHR_parallel_shader_compile) ---------- */
  renderer.debug.checkShaderErrors = false;
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* falls back to compile-on-first-frame */ }

  /* ---------- render loop ---------- */
  let running = true, raf = 0;
  const clock = new THREE.Clock();
  const frameCbs = [];
  // adaptive resolution: if the GPU can't hold ~45 fps, step the pixel ratio down (never below 1)
  let perfN = 0, perfSum = 0, lastT = 0;
  function adapt(dt) {
    if (dt <= 0 || dt > 0.25) return;
    perfSum += dt; perfN++;
    if (perfN < 45) return;
    const avg = perfSum / perfN; perfN = 0; perfSum = 0;
    const pr = renderer.getPixelRatio();
    if (avg > 0.022 && pr > 1) {
      renderer.setPixelRatio(Math.max(1, pr - 0.25)); W = 0; resize();
    }
  }
  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    adapt(t - lastT); lastT = t;
    applyCamera(t);
    renderer.render(scene, camera);
    for (const cb of frameCbs) cb(t);
  }
  loop();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); clock.stop(); }
    else if (running) { clock.start(); loop(); }
  });

  /* ---------- drums ---------- */
  const digitOf = v => ((Math.round(v) % 10) + 10) % 10;
  const rotFor = v => -v * TAU / 10;
  function tickWatcher(d) {
    let last = Math.floor(-d.roll.rotation.x * 10 / TAU + 0.5);
    return () => {
      const now = Math.floor(-d.roll.rotation.x * 10 / TAU + 0.5);
      if (now !== last) { last = now; S('tick'); haptic(5); }
    };
  }
  function animateDrumTo(i, target, duration) {
    const d = drums[i];
    if (d.tween) d.tween.kill();
    d.val = target;
    const watch = tickWatcher(d);
    d.tween = gsap.to(d.roll.rotation, {
      x: rotFor(target), duration: reduced ? 0.01 : duration,
      ease: reduced ? 'none' : 'back.out(1.5)', onUpdate: watch,
    });
  }
  let active = -1;
  function setActive(i) {
    if (i === active) return; active = i;
    drums.forEach((d, k) => gsap.to(d.mat, { emissiveIntensity: k === i ? 0.55 : 0.0, duration: 0.35, ease: 'power2.out' }));
  }

  const proj = new THREE.Vector3();
  function toScreen(v) { proj.copy(v).project(camera); return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * H }; }

  // the engraved wordmark sits under the code window: hide it while the HTML controls cover that area
  const fadeWord = (tl, v, pos) => { if (wordPlate) tl.to(wordPlate.material, { opacity: v, duration: 0.45, ease: 'power2.inOut' }, pos); };

  /* =================== public API =================== */
  const api = {
    is3D: true,
    onFrame(cb) { frameCbs.push(cb); },
    digits: () => drums.map(d => digitOf(d.val)),

    /* SCENE 01–02: camera dolly from the dark, lights rise, 15° orbit, light sweep */
    reveal() {
      const tl = gsap.timeline();
      const f = framing('intro');
      tl.set(rig, { ...framing('far') });
      if (reduced) {
        tl.set(rig, f);
        tl.to(scene, { environmentIntensity: LIGHTS_ON.env, duration: 0.6 }, 0);
        [[amb, 'amb'], [key, 'key'], [rim, 'rim'], [rim2, 'rim2'], [fill, 'fill']].forEach(([l, k]) => tl.to(l, { intensity: LIGHTS_ON[k], duration: 0.6 }, 0));
        return tl;
      }
      tl.to(rig, { dist: f.dist, tx: f.tx, ty: f.ty, el: f.el, duration: 3.4, ease: 'power3.inOut' }, 0)
        .fromTo(rig, { az: 15 * DEG }, { az: f.az, duration: 3.6, ease: 'power2.inOut' }, 0.2)
        .to(scene, { environmentIntensity: LIGHTS_ON.env, duration: 2.2, ease: 'power2.inOut' }, 0.5)
        .to(rim, { intensity: LIGHTS_ON.rim, duration: 1.6, ease: 'power2.out' }, 0.2)
        .to(rim2, { intensity: LIGHTS_ON.rim2, duration: 1.6, ease: 'power2.out' }, 0.5)
        .to(key, { intensity: LIGHTS_ON.key, duration: 2.0, ease: 'power2.inOut' }, 0.9)
        .to(amb, { intensity: LIGHTS_ON.amb, duration: 2.0 }, 0.9)
        .to(fill, { intensity: LIGHTS_ON.fill, duration: 2.0 }, 1.2)
        // light sweep across the door
        .set(sweep.position, { x: -4, y: 1.4, z: 2.2 }, 1.6)
        .to(sweep, { intensity: 26, duration: 0.5, ease: 'power1.out' }, 1.6)
        .to(sweep.position, { x: 4, y: -0.6, duration: 1.8, ease: 'power1.inOut' }, 1.6)
        .to(sweep, { intensity: 0, duration: 0.6, ease: 'power1.in' }, 2.8)
        .add(() => {
          stateName = 'intro';
          const s = { v: 0 }; gsap.to(s, { v: 1, duration: 2, onUpdate: () => { sway = s.v; } });
        }, 3.4);
      return tl;
    },

    /* SCENE 03: push in to the lock, open shutters, wake the drums one by one (120 ms apart) */
    activate() {
      const tl = gsap.timeline();
      const sw = { v: sway }; tl.to(sw, { v: 0, duration: 0.4, onUpdate: () => { sway = sw.v; } }, 0);
      camTo(tl, 'game', 1.1, 'power3.inOut', 0);
      const Dm = reduced ? 0.01 : 1;
      shutters.forEach(s => tl.to(s.mesh.position, { y: s.y0 + s.sy * (SLOT_H / 2 + 0.03), duration: 0.45 * Dm, ease: 'power3.inOut' }, 0.3));
      tl.add(() => S('clack'), 0.3);
      fadeWord(tl, 0, 0.2);
      tl.to(ledMat, { emissiveIntensity: 1.6, duration: 0.6 * Dm, ease: 'power2.out' }, 0.45);
      drums.forEach((d, i) => {
        const at = 0.62 + i * 0.12;
        d.val = 0;
        tl.set(d.roll.rotation, { x: rotFor(-3) }, 0);
        tl.to(d.roll.position, { z: DRUM_Z, duration: 0.42 * Dm, ease: 'back.out(1.6)' }, at);
        tl.to(d.roll.rotation, { x: 0, duration: 0.5 * Dm, ease: 'power3.out' }, at);
        tl.add(() => { S('tick'); haptic(8); }, at + 0.12);
        tl.fromTo(d.mat, { emissiveIntensity: 0.9 }, { emissiveIntensity: 0, duration: 0.6 * Dm, ease: 'power2.out' }, at + 0.1);
      });
      return tl;
    },

    /* SCENE 04: one mechanical step with inertia (180–250 ms) */
    step(i, dir) {
      const d = drums[i];
      animateDrumTo(i, Math.round(d.val) + dir, 0.22);
      setActive(i);
      return digitOf(d.val);
    },
    dragBegin(i) {
      const d = drums[i]; if (d.tween) d.tween.kill();
      d.dragBase = -d.roll.rotation.x * 10 / TAU; d.dragWatch = tickWatcher(d); setActive(i);
    },
    dragUpdate(i, deltaSteps) {
      const d = drums[i]; d.roll.rotation.x = rotFor(d.dragBase + deltaSteps); d.dragWatch();
    },
    dragEnd(i, deltaSteps, velocity) {
      const d = drums[i];
      const throwSteps = Math.max(-3, Math.min(3, velocity * 0.16));
      const target = Math.round(d.dragBase + deltaSteps + throwSteps);
      const dist = Math.abs(target - (d.dragBase + deltaSteps));
      animateDrumTo(i, target, 0.2 + Math.min(0.45, dist * 0.09));
      return digitOf(target);
    },
    setActive,

    /* screen positions of each drum (CSS px), for the HTML controls */
    drumScreen() {
      return drums.map(d => {
        const c = new THREE.Vector3(); d.roll.getWorldPosition(c);
        const front = c.clone(); front.z += DRUM_R;
        const top = front.clone(); top.y += DRUM_R * 0.72;
        const right = front.clone(); right.x += DRUM_L / 2;
        const p = toScreen(front), pt = toScreen(top), pr = toScreen(right);
        return { x: p.x, y: p.y, half: Math.abs(p.y - pt.y), halfW: Math.abs(pr.x - p.x) };
      });
    },

    /* SCENE 05, part A (0 – 1.9 s): seat digits, gears, camera to the lock, dial 90°, bolts */
    submitA() {
      const tl = gsap.timeline();
      const Dm = reduced ? 0.01 : 1;
      setActive(-1);
      fadeWord(tl, 1, 0);
      drums.forEach((d, i) => {
        const at = i * 0.09;
        tl.to(d.roll.position, { z: DRUM_Z - 0.035, duration: 0.12 * Dm, ease: 'power2.in' }, at)
          .to(d.roll.position, { z: DRUM_Z - 0.012, duration: 0.18 * Dm, ease: 'back.out(2)' }, at + 0.12)
          .fromTo(d.mat, { emissiveIntensity: 1.1 }, { emissiveIntensity: 0.25, duration: 0.5 * Dm }, at + 0.1)
          .add(() => { S('seat', i); haptic(10); }, at + 0.12);
      });
      // 0.5 – 1.2: gears turn, camera closes on the lock
      tl.add(() => S('gears', 0.7), 0.5);
      tl.to(ringGear.rotation, { z: '+=1.35', duration: 0.75 * Dm, ease: 'power2.inOut' }, 0.5);
      smallGears.forEach(g => tl.to(g.mesh.rotation, { z: `+=${g.dir * 4.2}`, duration: 0.75 * Dm, ease: 'power2.inOut' }, 0.5));
      camTo(tl, 'lock', 0.9, 'power2.inOut', 0.45);
      // 1.2 – 1.9: central dial 90°, bolts retract
      tl.to(dial.rotation, { z: '-=' + (Math.PI / 2), duration: 0.6 * Dm, ease: 'power3.inOut' }, 1.2);
      tl.add(() => { S('bolt'); haptic([18, 40, 18]); }, 1.25);
      faceBolts.forEach((b, k) => tl.to(b.rod.position, { x: b.x0 - b.sx * 0.12, duration: 0.42 * Dm, ease: 'power3.inOut' }, 1.3 + (k % 3) * 0.04));
      edgeBolts.forEach(b => tl.to(b.position, { x: -DOOR_W / 2 + 0.12, duration: 0.45 * Dm, ease: 'power3.inOut' }, 1.32));
      tl.to({}, { duration: 0.02 }, 1.88);
      return tl;
    },
    /* if the server failed: put the mechanism back */
    abortSubmit() {
      const tl = gsap.timeline();
      tl.to(dial.rotation, { z: '+=' + (Math.PI / 2), duration: 0.6, ease: 'power3.inOut' }, 0);
      faceBolts.forEach(b => tl.to(b.rod.position, { x: b.x0, duration: 0.4, ease: 'power3.inOut' }, 0.1));
      edgeBolts.forEach(b => tl.to(b.position, { x: -DOOR_W / 2 - 0.1, duration: 0.4 }, 0.1));
      drums.forEach(d => tl.to(d.roll.position, { z: DRUM_Z, duration: 0.3 }, 0.1));
      tl.to(drums.map(d => d.mat), { emissiveIntensity: 0, duration: 0.4 }, 0);
      fadeWord(tl, 0, 0.3);
      camTo(tl, 'game', 0.8, 'power2.inOut', 0);
      return tl;
    },
    /* SCENE 05, part B (1.9 – 3.0 s): door swings ~25°, gold light spills, camera flies into it */
    submitB() {
      const tl = gsap.timeline();
      tl.add(() => { S('door'); haptic(30); }, 0);
      if (!reduced) tl.to(doorPivot.rotation, { y: 25 * DEG, duration: 0.6, ease: 'power2.inOut' }, 0);
      tl.to(innerLight, { intensity: 34, duration: 0.6, ease: 'power2.in' }, 0.05)
        .to(backWallMat, { emissiveIntensity: 3.2, duration: 0.6, ease: 'power2.in' }, 0.05)
        .to(glowSprite.material, { opacity: 0.95, duration: 0.6, ease: 'power2.in' }, 0.1)
        .to(glowSprite.scale, { x: 4.4, y: 4.4, duration: 1.0, ease: 'power2.out' }, 0.1);
      if (!reduced) {
        const f = framing('lock');
        tl.to(rig, { tx: f.tx - 0.55, az: -9 * DEG, duration: 0.6, ease: 'power2.inOut' }, 0)
          .to(rig, { dist: f.dist * 0.42, tx: -0.95, ty: 0.05, az: -14 * DEG, duration: 0.55, ease: 'power3.in' }, 0.6);
        tl.add(() => S('whoosh'), 0.55);
      }
      tl.to({}, { duration: 0.01 }, 1.1);
      return tl;
    },
    /* instantly restore the closed vault (called while the screen is washed in light) */
    resetClosed(state) {
      gsap.killTweensOf([doorPivot.rotation, innerLight, backWallMat, glowSprite.material, glowSprite.scale, rig]);
      doorPivot.rotation.y = 0; innerLight.intensity = 0; backWallMat.emissiveIntensity = 0;
      glowSprite.material.opacity = 0; glowSprite.scale.set(0.1, 0.1, 1);
      faceBolts.forEach(b => { b.rod.position.x = b.x0; });
      edgeBolts.forEach(b => { b.position.x = -DOOR_W / 2 - 0.1; });
      drums.forEach(d => { d.roll.position.z = DRUM_Z; d.mat.emissiveIntensity = 0; });
      if (wordPlate) wordPlate.material.opacity = 0;
      dial.rotation.z = Math.round(dial.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
      const f = framing(state); f.dist *= 1.12; Object.assign(rig, f); stateName = state;
    },
    /* gentle push back to the mechanism (after the phone panel / between attempts) */
    settle(state = 'game') {
      const tl = gsap.timeline(); camTo(tl, state, 1.2, 'power3.out', 0); return tl;
    },
    pause() { running = false; cancelAnimationFrame(raf); },
    resume() { if (!running) { running = true; loop(); } },
    sweepLight() {
      if (reduced) return;
      gsap.timeline().set(sweep.position, { x: -3.5, y: 0.8, z: 2.2 }).to(sweep, { intensity: 18, duration: 0.3 })
        .to(sweep.position, { x: 3.5, y: -0.6, duration: 1.4, ease: 'power1.inOut' }, 0).to(sweep, { intensity: 0, duration: 0.4 }, 1.0);
    },
  };
  return api;
}
