/*
 * Narration for the walkthrough with Sarvam's Bulbul TTS (Indian English). One WAV per beat
 * in remotion/public/walkthrough/voice/, plus durations.json for the recorder and the edit.
 *
 *   SARVAM_API_KEY=... pnpm demo:voice            (DEMO_VOICE=shubh by default)
 *   pnpm demo:voice -- --only maya-3               regenerate one line
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { config } from "dotenv";
import { BEATS } from "./script";

config({ path: ".env.local", quiet: true });
const KEY = process.env.SARVAM_API_KEY;
if (!KEY) throw new Error("Set SARVAM_API_KEY in .env.local");
const SPEAKER = process.env.DEMO_VOICE ?? "shubh";
const DIR = "remotion/public/walkthrough/voice";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

mkdirSync(DIR, { recursive: true });
const durationsFile = `${DIR}/durations.json`;
const durations: Record<string, number> = existsSync(durationsFile) ? JSON.parse(readFileSync(durationsFile, "utf8")) : {};

/** Seconds of audio in a 16-bit PCM WAV, read from its header. */
function wavSeconds(buf: Buffer) {
  const rate = buf.readUInt32LE(24);
  const blockAlign = buf.readUInt16LE(32);
  const data = buf.indexOf("data");
  return buf.readUInt32LE(data + 4) / (rate * blockAlign);
}

for (const beat of BEATS) {
  if (only && beat.id !== only) continue;
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: beat.say,
      target_language_code: "en-IN",
      language_code: "en-IN",
      speaker: SPEAKER,
      model: "bulbul:v3",
      pace: 1.0,
      speech_sample_rate: 44100,
    }),
  });
  if (!res.ok) throw new Error(`${beat.id}: Sarvam ${res.status} ${await res.text()}`);
  const { audios } = (await res.json()) as { audios: string[] };
  const wav = Buffer.from(audios[0], "base64");
  writeFileSync(`${DIR}/${beat.id}.wav`, wav);
  durations[beat.id] = Number(wavSeconds(wav).toFixed(3));
  console.log(`${beat.id}  ${durations[beat.id].toFixed(1)}s`);
}
writeFileSync(durationsFile, JSON.stringify(durations, null, 2));
console.log(`total ${Object.values(durations).reduce((a, b) => a + b, 0).toFixed(0)}s of narration`);
