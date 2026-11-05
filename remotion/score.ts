/*
 * The launch film's soundtrack, composed in code: an original 120 BPM track (warm pad, plucked
 * arpeggio, sub bass, soft drums) plus every sound effect, placed from the same cue sheet the
 * picture animates on. No samples, no licences. Writes remotion/public/score.mp3.
 *
 *   pnpm video:score
 */
import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { BAR, CUE, DURATION, FPS, GU_COMPLAINT, graphemes, ORDER, SCENE_BARS, START } from "./timeline";

const SR = 44100;
const TAIL = 2.5; // seconds of reverb after the last frame
const LEN = Math.ceil((DURATION / FPS + TAIL) * SR);
const L = new Float32Array(LEN);
const R = new Float32Array(LEN);
const verbL = new Float32Array(LEN); // reverb send
const verbR = new Float32Array(LEN);
const duck = new Float32Array(LEN).fill(1); // sidechain gain from the kick

const sec = (frame: number) => frame / FPS;
const barSec = BAR / FPS; // 2s
const beatSec = barSec / 4;
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// Deterministic noise so every render of the score is identical.
let seed = 7;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;

function add(t: number, i: number, l: number, r: number, send = 0) {
  const n = Math.floor(t * SR) + i;
  if (n < 0 || n >= LEN) return;
  L[n] += l;
  R[n] += r;
  verbL[n] += l * send;
  verbR[n] += r * send;
}

/* ---------- instruments ---------- */

/** Warm pad: band-limited saw (8 harmonics), three detuned voices, slow attack and release. */
function pad(t: number, dur: number, notes: number[], gain: number, bright = 1) {
  const n = Math.floor((dur + 1.2) * SR);
  const voices = notes.flatMap((m) => [-6, 0, 6].map((cents, v) => ({ f: midi(m) * 2 ** (cents / 1200), pan: (v - 1) * 0.6 })));
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const env = Math.min(1, s / 0.6) * (s > dur ? Math.exp(-(s - dur) / 0.35) : 1);
    let l = 0;
    let r = 0;
    for (const { f, pan } of voices) {
      let v = 0;
      for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * f * h * s) / h ** (1.6 - 0.4 * bright);
      l += v * (1 - pan) * 0.5;
      r += v * (1 + pan) * 0.5;
    }
    const g = (gain * env) / voices.length;
    add(t, i, l * g, r * g, 0.5);
  }
}

/** Plucked mallet: sine + octave partial with a fast exponential decay. */
function pluck(t: number, m: number, gain: number, pan = 0) {
  const f = midi(m);
  const n = Math.floor(0.9 * SR);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const v = (Math.sin(2 * Math.PI * f * s) + 0.35 * Math.sin(4 * Math.PI * f * s) * Math.exp(-s * 18)) * Math.exp(-s * 7) * Math.min(1, s * 400);
    add(t, i, v * gain * (1 - pan), v * gain * (1 + pan), 0.35);
  }
}

function sub(t: number, m: number, dur: number, gain: number) {
  const f = midi(m);
  const n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const v = Math.sin(2 * Math.PI * f * s) * Math.min(1, s * 200) * Math.min(1, (dur - s) * 30) * gain;
    add(t, i, v, v);
  }
}

function kick(t: number, gain = 0.9) {
  const n = Math.floor(0.45 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    ph += (2 * Math.PI * (48 + 110 * Math.exp(-s * 35))) / SR;
    const v = Math.sin(ph) * Math.exp(-s * 7) * gain;
    add(t, i, v, v);
  }
  // duck pad and bass under the kick
  const start = Math.floor(t * SR);
  for (let i = 0; i < 0.3 * SR && start + i < LEN; i++) duck[start + i] = Math.min(duck[start + i], 0.35 + 0.65 * (i / (0.3 * SR)) ** 0.6);
}

function hat(t: number, gain = 0.08, open = false) {
  const n = Math.floor((open ? 0.18 : 0.04) * SR);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const x = noise();
    const v = (x - prev) * Math.exp(-(i / SR) * (open ? 22 : 90)) * gain; // crude high-pass
    prev = x;
    add(t, i, v * 0.8, v * 1.2);
  }
}

function clap(t: number, gain = 0.22) {
  const n = Math.floor(0.25 * SR);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const burst = [0, 0.011, 0.022].reduce((a, o) => a + (s >= o ? Math.exp(-(s - o) * 120) : 0), 0) + Math.exp(-s * 18) * 0.5;
    const v = noise() * burst * gain;
    add(t, i, v, v, 0.4);
  }
}

/* ---------- sound effects ---------- */

/** Band-passed noise sweeping up (or down), panned across: the transition whoosh. */
function whoosh(t: number, dur = 0.55, gain = 0.32, up = true) {
  const n = Math.floor(dur * SR);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const f = up ? 300 * 12 ** p : 3600 / 12 ** p;
    const w = (2 * Math.PI * f) / SR;
    const a = Math.sin(w) / (2 * 2.2); // RBJ band-pass, Q 2.2, 0 dB peak
    const x = noise();
    const y = (a * x - a * x2 + 2 * Math.cos(w) * y1 - (1 - a) * y2) / (1 + a);
    [x2, x1, y2, y1] = [x1, x, y1, y];
    const env = Math.sin(Math.PI * p) ** 1.5 * gain * 3;
    add(t - dur * 0.6, i, y * env * (1 - p), y * env * p, 0.3);
  }
}

function pop(t: number, gain = 0.35, pitch = 1) {
  const n = Math.floor(0.12 * SR);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const v = Math.sin(2 * Math.PI * (520 + 500 * Math.exp(-s * 40)) * pitch * s) * Math.exp(-s * 38) * gain;
    add(t, i, v, v, 0.25);
  }
}

function tick(t: number, gain = 0.06) {
  const n = Math.floor(0.012 * SR);
  for (let i = 0; i < n; i++) {
    const v = noise() * Math.exp(-(i / SR) * 500) * gain;
    add(t, i, v, v);
  }
}

function click(t: number) {
  tick(t, 0.25);
  tick(t + 0.045, 0.14);
}

function ding(t: number, gain = 0.25) {
  for (const [m, g] of [
    [88, 1],
    [95, 0.45],
    [100, 0.25],
  ]) {
    const f = midi(m);
    const n = Math.floor(1.8 * SR);
    for (let i = 0; i < n; i++) {
      const s = i / SR;
      const v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s * 3) * Math.min(1, s * 300) * gain * g;
      add(t, i, v, v, 0.6);
    }
  }
}

function impact(t: number, gain = 0.6) {
  const n = Math.floor(1.2 * SR);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const v = (Math.sin(2 * Math.PI * (38 + 40 * Math.exp(-s * 8)) * s) * Math.exp(-s * 3.2) + noise() * Math.exp(-s * 30) * 0.3) * gain;
    add(t, i, v, v, 0.5);
  }
}

function riser(t: number, dur: number, gain = 0.18) {
  const n = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    ph += (2 * Math.PI * (200 + 1400 * p * p)) / SR;
    const v = (Math.sin(ph) * 0.4 + noise() * 0.6 * p) * p ** 2 * gain;
    add(t, i, v * (1 - p * 0.5), v * (0.5 + p * 0.5), 0.6);
  }
}

/* ---------- the arrangement ---------- */

// D major, lifting: Dmaj9 | Bm9 | Gmaj9 | A6sus4. MIDI voicings around middle C.
const CHORDS = [
  { pad: [50, 57, 61, 64, 66], bass: 38, arp: [62, 66, 69, 73, 76, 73, 69, 66] },
  { pad: [47, 54, 57, 61, 62], bass: 35, arp: [59, 62, 66, 69, 73, 69, 66, 62] },
  { pad: [43, 50, 54, 57, 62], bass: 31, arp: [55, 59, 62, 66, 69, 66, 62, 59] },
  { pad: [45, 50, 52, 54, 57], bass: 33, arp: [57, 62, 64, 66, 69, 66, 64, 62] },
];

const barOf = (scene: (typeof ORDER)[number]) => START[scene] / BAR;
const TOTAL_BARS = DURATION / BAR;
const groove = (b: number) => (b >= barOf("translate") && b < barOf("handoff")) || (b >= barOf("relay") && b < barOf("close") + 2);
const dark = (b: number) => b >= barOf("handoff") && b < barOf("relay");
const tense = (b: number) => b >= barOf("problem") && b < barOf("translate");

for (let b = 0; b < TOTAL_BARS; b++) {
  const t = b * barSec;
  const c = CHORDS[b % 4];
  const last = b === TOTAL_BARS - 1;
  pad(t, last ? barSec + TAIL - 1 : barSec, c.pad, dark(b) ? 0.32 : 0.36, dark(b) ? 0.3 : b < 2 ? 0.5 + b * 0.25 : 1);
  if (b >= 1 && !last) {
    // 8th-note arpeggio (16ths in the full groove), gently panned
    const steps = groove(b) ? 16 : 8;
    for (let s = 0; s < steps; s++) {
      const m = c.arp[s % 8] + (groove(b) && s % 8 >= 6 ? 12 : 0);
      pluck(t + (s * barSec) / steps, m, dark(b) ? 0.12 : b < 2 ? 0.12 : 0.16, Math.sin(s * 1.3) * 0.5);
    }
  }
  if ((groove(b) || tense(b)) && !last) {
    for (let k = 0; k < 8; k++) sub(t + k * (barSec / 8), c.bass, barSec / 8 - 0.02, tense(b) ? 0.12 : 0.18);
  }
  if (groove(b) && !last) {
    for (let k = 0; k < 4; k++) kick(t + k * beatSec, 0.75);
    clap(t + beatSec, 0.1);
    clap(t + 3 * beatSec, 0.1);
    for (let k = 0; k < 8; k++) hat(t + k * (beatSec / 2) + beatSec / 2, 0.022, k === 7);
  }
  if (tense(b)) for (let k = 0; k < 16; k++) hat(t + (k * beatSec) / 4, k % 4 === 2 ? 0.018 : 0.009);
}

// Sound effects from the cue sheet.
const at = (scene: (typeof ORDER)[number], f: number) => sec(START[scene] + f);
ORDER.slice(1).forEach((k) => whoosh(at(k, 0), 0.55, 0.22));
impact(at("problem", 0), 0.45);
CUE.problem.pops.forEach((f, i) => pop(at("problem", f), 0.3, 1 + i * 0.06));
whoosh(at("problem", CUE.problem.collapse + 8), 0.45, 0.3, false);
pop(at("problem", CUE.problem.card), 0.4, 0.8);
graphemes(GU_COMPLAINT).forEach((_, i) => i % 2 === 0 && tick(at("translate", CUE.translate.typeFrom + i * CUE.translate.perChar)));
pop(at("translate", CUE.translate.desk), 0.25, 0.9);
pop(at("translate", CUE.translate.reply), 0.3, 1.1);
pop(at("translate", CUE.translate.back), 0.3, 1.2);
riser(at("handoff", SCENE_BARS.handoff * BAR - BAR), barSec, 0.16);
CUE.relay.steps.forEach((f, i) => pluck(at("relay", f), 74 + [0, 4, 7][i], 0.18));
pop(at("relay", CUE.relay.card), 0.35, 1);
click(at("resolution", CUE.resolution.press));
ding(at("resolution", CUE.resolution.press + 4));
impact(at("close", CUE.close.logo), 0.35);
ding(at("close", CUE.close.logo), 0.12);

/* ---------- mix: duck, reverb, master ---------- */

for (let i = 0; i < LEN; i++) {
  // the kick ducks everything but itself; good enough at this level
  L[i] *= 0.6 + 0.4 * duck[i];
  R[i] *= 0.6 + 0.4 * duck[i];
}

/** Small Schroeder reverb: four combs + two all-passes per side. */
function reverb(input: Float32Array, out: Float32Array, spread: number) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 }));
  const aps = [225, 556].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  for (let n = 0; n < input.length; n++) {
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * 0.8 + c.store * 0.2; // damping
      c.buf[c.i] = input[n] + c.store * 0.84;
      c.i = (c.i + 1) % c.buf.length;
      acc += y;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = acc + b * 0.5;
      acc = b - acc;
      a.i = (a.i + 1) % a.buf.length;
    }
    out[n] += acc * 0.18;
  }
}
reverb(verbL, L, 0);
reverb(verbR, R, 23);

// Fade the tail, soft-clip, normalise to -1 dBFS.
const fadeFrom = Math.floor((DURATION / FPS) * SR);
let peak = 0;
for (let i = 0; i < LEN; i++) {
  const g = i > fadeFrom ? Math.max(0, 1 - (i - fadeFrom) / (TAIL * SR)) : 1;
  L[i] = Math.tanh(L[i] * g * 1.2);
  R[i] = Math.tanh(R[i] * g * 1.2);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;

const wav = Buffer.alloc(44 + LEN * 4);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + LEN * 4, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) {
  wav.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4);
}
const tmp = "remotion/public/score.wav";
writeFileSync(tmp, wav);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-b:a", "256k", "remotion/public/score.mp3"]);
unlinkSync(tmp);
console.log(`score.mp3: ${(LEN / SR).toFixed(1)}s, peak normalised from ${peak.toFixed(2)}`);
