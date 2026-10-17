// TAMUR — mechanical sound design, synthesised with WebAudio (no audio files to download).
export function createSfx() {
  let ctx = null, master = null, noiseBuf = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.6;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  const ok = () => ctx && ctx.state === 'running';

  function noise(t, dur, { type = 'bandpass', f = 2000, f2, q = 1, gain = 0.4, attack = 0.001 } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.05);
  }
  function tone(t, dur, { f = 440, f2, type = 'sine', gain = 0.15, attack = 0.002 } = {}) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  let lastTick = 0;
  return {
    init,
    /* drum detent */
    tick() {
      if (!ok()) return; const t = ctx.currentTime;
      if (t - lastTick < 0.018) return; lastTick = t;
      const p = 0.92 + Math.random() * 0.16;
      noise(t, 0.03, { f: 3600 * p, q: 9, gain: 0.32 });
      tone(t, 0.022, { f: 2500 * p, gain: 0.05 });
      tone(t, 0.05, { f: 420 * p, f2: 300 * p, gain: 0.05, type: 'triangle' });
    },
    /* UI press */
    tap() {
      if (!ok()) return; const t = ctx.currentTime;
      noise(t, 0.035, { f: 5200, q: 5, gain: 0.12 }); tone(t, 0.05, { f: 1250, f2: 820, gain: 0.04 });
    },
    /* shutter / latch */
    clack() {
      if (!ok()) return; const t = ctx.currentTime;
      noise(t, 0.08, { f: 1500, q: 3, gain: 0.42 }); tone(t, 0.12, { f: 190, f2: 85, gain: 0.26 });
      noise(t + 0.09, 0.05, { f: 2600, q: 6, gain: 0.18 });
    },
    /* a digit seating into the lock */
    seat(i = 0) {
      if (!ok()) return; const t = ctx.currentTime, p = 1 + i * 0.07;
      noise(t, 0.05, { f: 2300 * p, q: 6, gain: 0.36 }); tone(t, 0.09, { f: 330 * p, f2: 170 * p, gain: 0.12 });
    },
    /* internal gear train */
    gears(dur = 0.7) {
      if (!ok()) return; const t = ctx.currentTime, n = Math.floor(dur / 0.03);
      for (let k = 0; k < n; k++) noise(t + k * 0.03, 0.02, { f: 2600 + k * 22, q: 11, gain: 0.1 + 0.05 * Math.sin(k) ** 2 });
      tone(t, dur, { f: 80, f2: 135, type: 'triangle', gain: 0.05, attack: 0.12 });
    },
    /* bolts sliding, then a heavy stop */
    bolt() {
      if (!ok()) return; const t = ctx.currentTime;
      noise(t, 0.34, { f: 650, f2: 2400, q: 2, gain: 0.22, attack: 0.05 });
      noise(t + 0.33, 0.14, { type: 'lowpass', f: 520, q: 1, gain: 0.6 });
      tone(t + 0.33, 0.22, { f: 105, f2: 55, gain: 0.38 });
    },
    /* the heavy door unseals; a warm golden chord */
    door() {
      if (!ok()) return; const t = ctx.currentTime;
      tone(t, 1.3, { f: 58, f2: 46, gain: 0.34, attack: 0.12 });
      noise(t, 1.0, { type: 'lowpass', f: 180, f2: 1500, q: 0.7, gain: 0.22, attack: 0.25 });
      noise(t, 0.12, { f: 900, q: 2, gain: 0.25 });
      [659.25, 987.77, 1318.51, 1975.53].forEach((f, k) => tone(t + 0.22 + k * 0.07, 1.8, { f, gain: 0.03 - k * 0.004, attack: 0.45 }));
    },
    /* camera flying through the light */
    whoosh() {
      if (!ok()) return; const t = ctx.currentTime;
      noise(t, 0.8, { f: 260, f2: 3400, q: 0.8, gain: 0.22, attack: 0.3 });
    },
    /* finale accent */
    chime() {
      if (!ok()) return; const t = ctx.currentTime;
      [523.25, 783.99, 1046.5, 1567.98].forEach((f, k) => tone(t + k * 0.09, 2.2, { f, gain: 0.035, attack: 0.02 }));
    },
  };
}
