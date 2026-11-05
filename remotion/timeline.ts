/*
 * One clock for picture and sound. 120 BPM at 30fps: a beat is 15 frames, a bar is 60.
 * Every scene starts on a bar line, and every sound effect in the score is placed from the
 * same frame numbers the scenes animate on, so cuts, pops and clicks always land together.
 */
export const FPS = 30;
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15 frames
export const BAR = BEAT * 4; // 60 frames
export const T = BEAT; // every transition lasts one beat

export const SCENE_BARS = { intro: 2, problem: 3, translate: 5, handoff: 4, relay: 4, resolution: 4, close: 4 } as const;
export type SceneKey = keyof typeof SCENE_BARS;
export const ORDER = Object.keys(SCENE_BARS) as SceneKey[];

/** Absolute frame each scene starts on (always a bar line). */
export const START = Object.fromEntries(
  ORDER.map((k, i) => [k, ORDER.slice(0, i).reduce((n, p) => n + SCENE_BARS[p] * BAR, 0)]),
) as Record<SceneKey, number>;
export const DURATION = ORDER.reduce((n, k) => n + SCENE_BARS[k] * BAR, 0);

/** Scene-relative moments, shared by the animation and the score. */
export const CUE = {
  intro: { mark: 4, words: 30, expand: 96 },
  problem: { pops: [30, 45, 60, 75, 90, 105], collapse: 120, card: 135 },
  translate: { typeFrom: 20, perChar: 1.4, desk: 100, reply: 165, back: 210 },
  handoff: { focus: 10, push: 150 },
  relay: { steps: [45, 90, 135], card: 180 },
  resolution: { press: 100, stats: 140 },
  close: { out: 96, logo: 112 },
} as const;

/** The customer's complaint, typed on screen (the score ticks along with it). */
export const GU_COMPLAINT = "મારું વોશિંગ મશીન સ્પિન વખતે નીચેથી પાણી લીક કરે છે.";
export const graphemes = (s: string) => [...new Intl.Segmenter().segment(s)].map((g) => g.segment);
