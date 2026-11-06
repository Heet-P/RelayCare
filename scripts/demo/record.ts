/*
 * Records the walkthrough on the REAL app: a browser signs in as each person and performs the
 * whole journey (live typing, a visible cursor or touch dot), one take per scene. Each beat's
 * action runs, then the take holds until that beat's narration has been spoken (voice.ts
 * durations, or a words-per-second estimate before the voice exists), so footage and voice
 * line up without manual editing.
 *
 * Output (remotion/public/walkthrough/): <scene>.mp4 per take + takes.json with each beat's
 * start time and an optional focus box for the edit's zooms.
 *
 *   pnpm demo:reset && pnpm demo:record        (dev server on :3000, Docker store not needed)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import { config } from "dotenv";
import postgres from "postgres";
import { tr } from "@/lib/i18n";
import { BEATS, type Scene } from "./script";

config({ path: ".env.local", quiet: true });
const BASE = process.env.DEMO_URL ?? "http://localhost:3000";
const OUT = "remotion/public/walkthrough";
const VOICE = `${OUT}/voice/durations.json`;
const voiced: Record<string, number> = existsSync(VOICE) ? JSON.parse(readFileSync(VOICE, "utf8")) : {};
const say = Object.fromEntries(BEATS.map((b) => [b.id, b.say]));
/** How long a beat must last on screen: its narration plus a breath. */
const beatSeconds = (id: string) => (voiced[id] ?? say[id].split(/\s+/).length / 2.7) + 0.45;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const gu = tr("gu");
const hi = tr("hi");

type Box = { x: number; y: number; w: number; h: number }; // fractions of the viewport
type Mark = { id: string; t: number; focus?: Box };

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 402, height: 874 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true },
} as const;

/** A visible pointer: an arrow on desktop, a soft touch dot on phones. Survives navigation. */
const cursorScript = (touch: boolean) => `(() => {
  const ensure = () => {
    if (document.getElementById("__demo_cursor")) return document.getElementById("__demo_cursor");
    const c = document.createElement("div");
    c.id = "__demo_cursor";
    c.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;transition:transform 120ms cubic-bezier(.23,1,.32,1);" +
      (${touch} ? "width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(28,25,23,.18);border:2px solid rgba(255,255,255,.9);box-shadow:0 4px 14px rgba(0,0,0,.25);"
                : "width:22px;height:30px;background:url(\\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 30'%3E%3Cpath d='M2 2l16 15h-9l5 10-4 2-5-10-3 6z' fill='%231c1917' stroke='white' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E\\") no-repeat;");
    const p = JSON.parse(sessionStorage.getItem("__demo_cursor") || "[-80,-80]");
    c.style.translate = p[0] + "px " + p[1] + "px";
    document.documentElement.appendChild(c);
    return c;
  };
  addEventListener("mousemove", (e) => { ensure().style.translate = e.clientX + "px " + e.clientY + "px"; sessionStorage.setItem("__demo_cursor", JSON.stringify([e.clientX, e.clientY])); }, true);
  addEventListener("mousedown", () => { ensure().style.transform = "scale(${0.8})"; }, true);
  addEventListener("mouseup", () => { ensure().style.transform = ""; }, true);
  document.addEventListener("DOMContentLoaded", () => {
    ensure();
    // hide the Next.js dev badge so takes look like production
    const s = document.createElement("style");
    s.textContent = "nextjs-portal{display:none!important}";
    document.head.appendChild(s);
  });
})();`;

class Take {
  frames: { data: Buffer; t: number }[] = [];
  marks: Mark[] = [];
  private pos = { x: -80, y: -80 };
  private stopAt = 0;

  constructor(
    readonly page: Page,
    readonly scene: Scene,
    readonly device: keyof typeof DEVICES,
  ) {}

  async start() {
    const cdp = await this.page.context().newCDPSession(this.page);
    const { width, height } = DEVICES[this.device].viewport;
    const dpr = DEVICES[this.device].deviceScaleFactor;
    cdp.on("Page.screencastFrame", (f) => {
      this.frames.push({ data: Buffer.from(f.data, "base64"), t: f.metadata.timestamp ?? Date.now() / 1000 });
      void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: width * dpr, maxHeight: height * dpr });
    await sleep(400);
    return cdp;
  }

  /** One narrated beat: do the action, then hold until the line has been spoken. */
  async beat(id: string, action: () => Promise<void> = async () => {}) {
    if (!say[id]) throw new Error(`Unknown beat ${id}`);
    const t0 = Date.now();
    this.marks.push({ id, t: t0 / 1000 });
    process.stdout.write(`  ${id} `);
    await action();
    const left = beatSeconds(id) * 1000 - (Date.now() - t0);
    console.log(left < 0 ? `(action ran ${(-left / 1000).toFixed(1)}s over the line)` : "");
    await sleep(left);
  }

  /** Point the edit's camera at an element for the current beat. */
  async focus(target: Locator) {
    const b = await target.boundingBox();
    const { width, height } = DEVICES[this.device].viewport;
    if (b) this.marks[this.marks.length - 1].focus = { x: b.x / width, y: b.y / height, w: b.width / width, h: b.height / height };
  }

  /** Glide the pointer to the element (ease-out, ~0.5s) and click it. */
  async click(target: Locator) {
    await target.scrollIntoViewIfNeeded();
    await sleep(150);
    const b = await target.boundingBox();
    if (!b) throw new Error(`Not visible: ${target}`);
    const to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const from = this.pos.x < 0 ? { x: to.x + 140, y: to.y + 160 } : this.pos;
    const steps = 22;
    for (let i = 1; i <= steps; i++) {
      const k = 1 - (1 - i / steps) ** 3;
      await this.page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
      await sleep(16);
    }
    this.pos = to;
    await sleep(120);
    await this.page.mouse.down();
    await sleep(90);
    await this.page.mouse.up();
    await sleep(250);
  }

  /** Type like a person: per character (per grapheme for Indic scripts), uneven rhythm. */
  async type(target: Locator, text: string, cps = 16) {
    await this.click(target);
    for (const { segment } of new Intl.Segmenter().segment(text)) {
      if (/^[\x20-\x7e]$/.test(segment)) await this.page.keyboard.type(segment);
      else await this.page.keyboard.insertText(segment);
      await sleep((1000 / cps) * (0.6 + Math.random() * 0.8) + (segment === " " ? 40 : 0));
    }
  }

  /** A slow, visible wheel scroll (Lenis smooths it on the page). */
  async scroll(px: number, ms = 1200) {
    const { width, height } = DEVICES[this.device].viewport;
    if (this.pos.x < 0) await this.page.mouse.move(width / 2, height / 2);
    const n = Math.max(1, Math.round(ms / 60));
    for (let i = 0; i < n; i++) {
      await this.page.mouse.wheel(0, px / n);
      await sleep(60);
    }
  }

  async stop(cdp: Awaited<ReturnType<Take["start"]>>) {
    await sleep(300);
    this.stopAt = Date.now() / 1000;
    await cdp.send("Page.stopScreencast").catch(() => undefined);
    await this.encode();
  }

  /** Variable-rate screencast frames → constant 30fps H.264, timed by each frame's timestamp. */
  private async encode() {
    if (!this.frames.length) throw new Error(`${this.scene}: no frames captured`);
    const dir = path.join(tmpdir(), `rc-take-${this.scene}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const lines: string[] = [];
    this.frames.forEach((f, i) => {
      const name = `f${String(i).padStart(5, "0")}.jpg`;
      writeFileSync(path.join(dir, name), f.data);
      const next = this.frames[i + 1]?.t ?? this.stopAt;
      lines.push(`file '${name}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
    });
    lines.push(`file 'f${String(this.frames.length - 1).padStart(5, "0")}.jpg'`);
    writeFileSync(path.join(dir, "list.txt"), lines.join("\n"));
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
      "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", "medium",
      `${OUT}/${this.scene}.mp4`,
    ]);
    rmSync(dir, { recursive: true, force: true });
  }

  /** Beat times relative to the first frame of the take, for the edit. */
  summary() {
    const t0 = this.frames[0].t;
    return {
      scene: this.scene,
      device: this.device,
      duration: this.stopAt - t0,
      beats: this.marks.map((m) => ({ ...m, t: Number((m.t - t0).toFixed(3)) })),
    };
  }
}

async function record(browser: Browser, scene: Scene, device: keyof typeof DEVICES, as: string | null, start: string, run: (take: Take) => Promise<void>) {
  console.log(`\n${scene} (${device}${as ? `, ${as}` : ""})`);
  const context = await browser.newContext({ ...DEVICES[device], baseURL: BASE, colorScheme: "light", locale: "en-IN", timezoneId: "Asia/Kolkata" });
  await context.addInitScript(cursorScript(DEVICES[device].hasTouch));
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  if (as) await page.goto(`/api/dev/sign-in?as=${as}&next=${encodeURIComponent(start)}`);
  else await page.goto(start);
  await page.waitForLoadState("load");
  await sleep(1500); // fonts, chat connection, first paint settle before rolling
  const take = new Take(page, scene, device);
  const cdp = await take.start();
  try {
    await run(take);
  } finally {
    await take.stop(cdp);
    await context.close();
  }
  return take.summary();
}

async function main() {
  // Everyone in their own language, whatever earlier testing left behind.
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  await sql`update users set locale = case email when 'customer@relaycare.test' then 'gu' when 'ravi@relaycare.test' then 'hi' else 'en' end
    where email in ('customer@relaycare.test', 'ravi@relaycare.test', 'maya@relaycare.test', 'arjun@relaycare.test')`;
  await sql.end();

  const browser = await chromium.launch({ channel: "chrome" }); // the installed Chrome; no extra download
  const takes: ReturnType<Take["summary"]>[] = [];
  let caseUrl = "";

  try {
    takes.push(
      await record(browser, "intro", "desktop", null, "/", async (s) => {
        await s.beat("intro-1", async () => {
          await s.focus(s.page.locator("h1"));
        });
        await s.beat("intro-2", async () => {
          await s.scroll(900, 2500);
        });
      }),
    );

    takes.push(
      await record(browser, "customer", "phone", "customer", "/my-orders", async (s) => {
        const p = s.page;
        await s.beat("cust-1", async () => {
          await s.focus(p.locator("article, .panel").filter({ hasText: "10842" }).first());
        });
        await s.beat("cust-2", async () => {
          const order = p.locator("article, .panel").filter({ hasText: "10842" }).first();
        await s.click(order.getByRole("link", { name: gu.getHelp }));
          await p.waitForURL(/\/support\/new/);
          const item = p.locator("label:has(input[name=item])").filter({ hasText: "AquaWash" }).first();
          if (await item.count()) await s.click(item);
          await s.click(p.getByRole("button", { name: gu.continue }));
        });
        await s.beat("cust-3", async () => {
          await s.click(p.locator("label:has(input[name=category])").first());
          await s.click(p.getByRole("button", { name: gu.continue }));
        });
        await s.beat("cust-4", async () => {
          await s.type(p.locator("#description"), "સ્પિન વખતે મશીનની નીચેથી પાણી લીક થાય છે. ફ્લોર ભીનું થઈ જાય છે.", 9);
        });
        await s.beat("cust-5", async () => {
          await s.type(p.locator("#tried"), "પાઇપ ટાઇટ કરી", 9);
          await p.keyboard.press("Enter");
          await s.focus(p.locator("#serial"));
          await s.click(p.getByRole("button", { name: gu.continue }));
        });
        await s.beat("cust-6", async () => {
          await s.click(p.getByRole("button", { name: gu.continue }));
          await sleep(600);
          await s.click(p.getByRole("button", { name: gu.send }));
          await p.waitForURL(/\/my-cases\/[0-9a-f-]{36}/);
          caseUrl = new URL(p.url()).pathname;
        });
        await s.beat("cust-7", async () => {
          await s.focus(p.getByLabel("Progress"));
          await sleep(1500);
          await s.scroll(420, 1500);
        });
        await s.beat("cust-8", async () => {
          const box = p.getByLabel("Message");
          await box.waitFor();
          await sleep(800);
          await s.type(box, "મશીન હજી પણ લીક કરે છે, કૃપા કરીને મદદ કરો.", 9);
          await s.click(p.getByRole("button", { name: "Send", exact: true }));
        });
      }),
    );
    const caseId = caseUrl.split("/").pop()!;

    takes.push(
      await record(browser, "maya", "desktop", "maya", "/dashboard", async (s) => {
        const p = s.page;
        await s.beat("maya-1", async () => {
          await s.focus(p.locator("main").first());
        });
        await s.beat("maya-2", async () => {
          await s.click(p.locator(`a[href="/dashboard/cases/${caseId}"]`).first());
          await p.waitForURL(/\/dashboard\/cases\//);
          await s.focus(p.locator("header").first());
        });
        await s.beat("maya-3", async () => {
          await s.focus(p.getByRole("region", { name: "Conversation" }));
        });
        await s.beat("maya-4", async () => {
          await s.type(p.getByLabel("Message"), "Sorry about that! Could you tell me when it started leaking?", 18);
          await s.click(p.getByRole("button", { name: "Send", exact: true }));
        });
        await s.beat("maya-5", async () => {
          await s.click(p.getByRole("button", { name: "Start review" }));
          await sleep(1200);
          await s.click(p.getByRole("button", { name: "Check warranty" }));
          await sleep(1200);
          await s.click(p.getByRole("button", { name: "Verify warranty" }));
          await s.click(p.locator("label:has(input[name=warranty][value=eligible])"));
          await s.click(p.getByRole("button", { name: "Save decision" }));
        });
        await s.beat("maya-6", async () => {
          await s.click(p.getByRole("button", { name: "Prepare handoff" }));
          const dialog = p.getByRole("dialog");
          await s.type(dialog.getByPlaceholder("Leakage occurs during wash cycle"), "Leaks from the bottom during spin", 20);
          await p.keyboard.press("Enter");
          await s.type(dialog.locator("#action"), "Inspect the door seal and drain pump, replace the seal if worn", 20);
          await dialog.locator("#priority").selectOption("high");
        });
        await s.beat("maya-7", async () => {
          await s.click(p.getByRole("dialog").getByRole("button", { name: "Send to dispatch" }));
        });
      }),
    );

    takes.push(
      await record(browser, "arjun", "desktop", "arjun", "/dashboard/dispatch", async (s) => {
        const p = s.page;
        await s.beat("arjun-1", async () => {
          await s.scroll(300, 1500);
        });
        await s.beat("arjun-2", async () => {
          await s.click(p.getByRole("button", { name: "Assign technician" }).first());
          const dialog = p.getByRole("dialog");
          await s.click(dialog.locator("label:has(input[name=technician])").filter({ hasText: "Ravi" }));
          await s.click(dialog.getByRole("button", { name: "Tomorrow 10:00" }));
          await s.click(dialog.getByRole("button", { name: "Assign", exact: true }));
        });
        await s.beat("arjun-3");
      }),
    );

    takes.push(
      await record(browser, "ravi", "phone", "ravi", "/technician/jobs", async (s) => {
        const p = s.page;
        await s.beat("ravi-1", async () => {
          await s.focus(p.locator(`a[href="/technician/jobs/${caseId}"]`));
        });
        await s.beat("ravi-2", async () => {
          await s.click(p.locator(`a[href="/technician/jobs/${caseId}"]`));
          await p.waitForURL(/\/technician\/jobs\//);
          await sleep(1000);
          await s.scroll(900, 4000);
        });
        await s.beat("ravi-3", async () => {
          await s.click(p.getByRole("button", { name: hi.acceptJob }));
          await s.click(p.getByRole("button", { name: hi.startWork }));
        });
        await s.beat("ravi-4", async () => {
          await s.type(p.locator("#findings"), "Door seal torn at the base", 18);
          await s.type(p.locator("#work"), "Replaced the door seal and ran a test wash, no leak", 18);
        });
        await s.beat("ravi-5", async () => {
          await p.locator('input[type=file][accept*="video/quicktime"]').last().setInputFiles(`${OUT}/repair-photo.jpg`);
          const submit = p.getByRole("button", { name: hi.completeWork });
          await submit.and(p.locator(":enabled")).waitFor({ timeout: 30_000 });
          await s.click(submit);
        });
      }),
    );

    takes.push(
      await record(browser, "confirm", "phone", "customer", caseUrl, async (s) => {
        const p = s.page;
        await s.beat("conf-1", async () => {
          await s.focus(p.getByLabel("Confirm the repair"));
          await sleep(2500);
          await s.click(p.getByRole("button", { name: gu.isFixed }));
        });
        await s.beat("conf-2", async () => {
          await s.click(p.getByRole("radio", { name: "5 out of 5" }));
          await s.click(p.getByRole("button", { name: gu.sendRating }));
        });
      }),
    );

    takes.push(
      await record(browser, "close", "desktop", "maya", `/dashboard/cases/${caseId}`, async (s) => {
        const p = s.page;
        await s.beat("close-1", async () => {
          await s.click(p.getByRole("button", { name: "Close case" }));
          await sleep(1000);
          await s.scroll(700, 3000);
        });
        await s.beat("close-2", async () => {
          await p.goto("/");
        });
      }),
    );
  } finally {
    await browser.close();
    writeFileSync(`${OUT}/takes.json`, JSON.stringify({ voiced: Object.keys(voiced).length > 0, takes }, null, 2));
    console.log(`\nwrote ${takes.length} takes to ${OUT}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
