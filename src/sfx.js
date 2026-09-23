// Звуки гри — синтез на WebAudio, без файлів. Вимкнення звуку пам'ятаємо в браузері.
const KEY = 'magicair-sound';
const VOL = 0.6;
let ctx = null, master = null, noiseBuf = null, hiss = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === 'off'; } catch (_) { /* нема сховища */ }

function ac() {
  if (!ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOL;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Браузер дозволяє звук лише після дотику — викликаємо на кожен дотик
export function unlock() { ac(); }
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch (_) { /* нема сховища */ }
  if (m) inflateStop();
  if (master) master.gain.setTargetAtTime(m ? 0 : VOL, ctx.currentTime, 0.02);
}

function tone({ f = 440, f2, type = 'sine', dur = 0.15, vol = 0.2, at = 0 }) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBuffer(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noise({ dur = 0.1, vol = 0.3, freq = 1000, f2, q = 1, type = 'bandpass', at = 0 }) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + at;
  const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuffer(c);
  flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(freq, t);
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// Щоб купа однакових подій не зливалась у шум
const last = {};
function throttle(name, ms) {
  const now = Date.now();
  if (now - (last[name] || 0) < ms) return false;
  last[name] = now;
  return true;
}

// ---------- гелій: шипить, поки тримаєш; тон росте разом із кулькою ----------
export function inflateStart() {
  const c = ac();
  if (!c || muted || hiss) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c); src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(0.16, c.currentTime + 0.05);
  src.connect(bp).connect(g).connect(master);
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 180;
  const og = c.createGain(); og.gain.value = 0.035;
  o.connect(og).connect(master);
  src.start(); o.start();
  hiss = { src, bp, g, o, og };
}
export function inflateLevel(f) {
  if (!hiss) return;
  hiss.bp.frequency.setTargetAtTime(600 + f * 2400, ctx.currentTime, 0.03);
  hiss.o.frequency.setTargetAtTime(180 + f * 420, ctx.currentTime, 0.03);
}
export function inflateStop() {
  if (!hiss) return;
  const { src, g, o, og } = hiss;
  hiss = null;
  const t = ctx.currentTime;
  g.gain.setTargetAtTime(0, t, 0.03); og.gain.setTargetAtTime(0, t, 0.03);
  src.stop(t + 0.25); o.stop(t + 0.25);
}

// ---------- події ----------
export const click = () => tone({ f: 700, f2: 900, dur: 0.06, vol: 0.12 });
export const pick = () => tone({ f: 520, f2: 820, type: 'triangle', dur: 0.09, vol: 0.14 });
export const perfect = () => { tone({ f: 988, dur: 0.12, vol: 0.14 }); tone({ f: 1480, dur: 0.22, vol: 0.12, at: 0.07 }); };
export const under = () => tone({ f: 420, f2: 300, type: 'triangle', dur: 0.18, vol: 0.14 });
export const tie = () => { tone({ f: 900, f2: 1500, dur: 0.06, vol: 0.12 }); tone({ f: 1500, f2: 1000, dur: 0.07, vol: 0.1, at: 0.06 }); };
export const pop = () => {
  noise({ dur: 0.09, vol: 0.8, freq: 2500, type: 'highpass', q: 0.5 });
  tone({ f: 190, f2: 55, dur: 0.14, vol: 0.45 });
};
export const discard = () => noise({ dur: 0.25, vol: 0.25, freq: 2500, f2: 400, q: 2 });
export const coin = () => {
  if (!throttle('coin', 55)) return;
  tone({ f: 1319, type: 'triangle', dur: 0.07, vol: 0.12 });
  tone({ f: 1976, type: 'triangle', dur: 0.2, vol: 0.1, at: 0.05 });
};
export const tip = () => [1047, 1319, 1568, 2093].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.18, vol: 0.1, at: i * 0.06 }));
export const wrong = () => { if (!throttle('wrong', 200)) return; tone({ f: 190, type: 'sawtooth', dur: 0.12, vol: 0.08 }); tone({ f: 150, type: 'sawtooth', dur: 0.16, vol: 0.08, at: 0.13 }); };
export const leave = () => tone({ f: 460, f2: 210, type: 'triangle', dur: 0.35, vol: 0.12 });
export const arrive = () => { if (!throttle('arrive', 1200)) return; tone({ f: 1319, dur: 0.3, vol: 0.06 }); tone({ f: 1047, dur: 0.4, vol: 0.06, at: 0.16 }); };
export const noHelium = () => { if (!throttle('nohe', 600)) return; tone({ f: 330, type: 'square', dur: 0.1, vol: 0.06 }); tone({ f: 330, type: 'square', dur: 0.1, vol: 0.06, at: 0.16 }); };
export const refilled = () => { noise({ dur: 0.3, vol: 0.15, freq: 1500, q: 1 }); tone({ f: 784, dur: 0.2, vol: 0.1, at: 0.2 }); };
export const tick = () => tone({ f: 1800, type: 'square', dur: 0.03, vol: 0.05 });
export const shiftOver = () => [784, 988, 1175, 1568].forEach((f, i) => tone({ f, type: 'triangle', dur: i === 3 ? 0.5 : 0.14, vol: 0.13, at: i * 0.11 }));
export const star = (i) => tone({ f: [880, 1109, 1319][i] || 1319, type: 'triangle', dur: 0.35, vol: 0.14 });
export const count = () => { if (throttle('count', 45)) tone({ f: 1400, dur: 0.025, vol: 0.04 }); };
export const buy = () => { coin(); tone({ f: 2349, type: 'triangle', dur: 0.25, vol: 0.08, at: 0.12 }); };
// телефон: нове онлайн-замовлення
export const phone = () => [0, 0.16, 0.5, 0.66].forEach((at) => { tone({ f: 1320, type: 'square', dur: 0.1, vol: 0.05, at }); tone({ f: 1760, type: 'square', dur: 0.1, vol: 0.04, at: at + 0.05 }); });
export const pack = () => { noise({ dur: 0.12, vol: 0.3, freq: 500, type: 'lowpass' }); tone({ f: 660, f2: 990, type: 'triangle', dur: 0.12, vol: 0.12, at: 0.08 }); };
export const upgrade = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, type: 'triangle', dur: i === 4 ? 0.45 : 0.12, vol: 0.12, at: i * 0.08 }));
