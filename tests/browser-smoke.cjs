const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildSync } = require("esbuild");
const { chromium } = require("playwright-core");

const packageDirectory = path.resolve(__dirname, "..");
const bundlePath = path.join(packageDirectory, ".browser-smoke", "fixture.js");
const executableCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

if (!executablePath) {
  throw new Error("Chrome was not found. Set the CHROME_PATH environment variable.");
}

fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
buildSync({
  entryPoints: [path.join(__dirname, "browser-fixture.tsx")],
  bundle: true,
  format: "iife",
  target: "chrome120",
  outfile: bundlePath,
  logLevel: "silent"
});

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.setContent(
      '<style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}</style><div id="root"></div>'
    );
    await page.addScriptTag({ path: bundlePath });
    await page.waitForFunction(() => {
      const api = window.mascotSmoke?.ref.current;
      return api?.getSnapshot()?.state === "idle" &&
        document.querySelector('[data-seam-mascot] g > path')?.getAttribute("d");
    });

    const initial = await page.evaluate(() => window.mascotSmoke.ref.current.getSnapshot());
    assert.equal(initial.state, "idle");
    assert.deepEqual(initial.position, { x: 600, y: 300 });
    const idleTipTiming = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      return {
        speed: machine.idleMotion.tipSpeed,
        attacks: machine.idleTipStates.map((state) => state.attackDuration),
        releases: machine.idleTipStates.map((state) => state.releaseDuration)
      };
    });
    assert.equal(idleTipTiming.speed, 1.45);
    assert.ok(idleTipTiming.attacks.every((duration) => duration <= 942));
    assert.ok(idleTipTiming.releases.every((duration) => duration <= 1291));

    const initialEyeHeights = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-seam-mascot] > g > path'))
        .slice(1)
        .map((eye) => eye.getBBox().height)
    );
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.randomBlinking && snapshot.blinkAmount > 0.75;
    });
    const proceduralBlink = await page.evaluate(() => ({
      snapshot: window.mascotSmoke.ref.current.getSnapshot(),
      duration: window.mascotSmoke.ref.current.getMachine().randomBlinkDuration,
      eyeHeights: Array.from(
        document.querySelectorAll('[data-seam-mascot] > g > path')
      ).slice(1).map((eye) => eye.getBBox().height)
    }));
    assert.equal(proceduralBlink.snapshot.state, "idle");
    assert.equal(proceduralBlink.snapshot.reacting, false);
    assert.ok(proceduralBlink.duration >= 130 && proceduralBlink.duration <= 180);
    assert.ok(
      proceduralBlink.eyeHeights.every(
        (height, index) => height < initialEyeHeights[index] * 0.4
      ),
      "Procedural blink should close both eyes"
    );
    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.randomBlinking === false
    );

    await page.mouse.click(600, 300);
    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.reactionAmount > 0.08
    );
    const outwardReaction = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      return {
        snapshot: machine.getSnapshot(),
        tipRatios: machine.idleTipModel.tips.map(({ tipIndex }) => {
          const source = machine.geometry.star.body[tipIndex];
          const current = machine.geometry.bodyBuffer[tipIndex];
          return Math.hypot(current.x, current.y) / Math.hypot(source.x, source.y);
        }),
        bodyTransform: document
          .querySelector('[data-seam-mascot] > g > path')
          .getAttribute("transform")
      };
    });
    assert.equal(outwardReaction.snapshot.state, "idle");
    assert.equal(outwardReaction.snapshot.hasTarget, false);
    assert.ok(outwardReaction.tipRatios.every((ratio) => ratio > 1.06));
    assert.equal(outwardReaction.bodyTransform, null, "Reaction must not rotate");

    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.blinkAmount > 0.82
    );
    const blinkEyeHeights = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-seam-mascot] > g > path'))
        .slice(1)
        .map((eye) => eye.getBBox().height)
    );
    assert.ok(
      blinkEyeHeights.every((height, index) => height < initialEyeHeights[index] * 0.3),
      "Both eyes should blink in place"
    );

    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.reactionAmount < -0.03
    );
    const inwardTipRatios = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      return machine.idleTipModel.tips.map(({ tipIndex }) => {
        const source = machine.geometry.star.body[tipIndex];
        const current = machine.geometry.bodyBuffer[tipIndex];
        return Math.hypot(current.x, current.y) / Math.hypot(source.x, source.y);
      });
    });
    assert.ok(inwardTipRatios.every((ratio) => ratio < 0.985));
    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.reacting === false
    );

    await page.mouse.move(1020, 190);
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot && snapshot.position.x > 720 && snapshot.morph > 0.75;
    });

    const moving = await page.evaluate(() => window.mascotSmoke.ref.current.getSnapshot());
    assert.ok(moving.speed > 0, "Pointer follow should produce velocity");
    assert.ok(moving.tailRate > 3.2, "Tail rate should respond to velocity");

    await page.evaluate(() => {
      window.mascotSmoke.snapshots.length = 0;
      window.mascotSmoke.ref.current.follow(120, 420);
    });
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot && snapshot.facing === -1 && !snapshot.turning;
    });
    const reversalStates = await page.evaluate(() =>
      window.mascotSmoke.snapshots.map((snapshot) => snapshot.state)
    );
    assert.ok(
      !reversalStates.includes("idle"),
      "Direction reversal should not pass through idle"
    );

    const settlingReaction = await page.evaluate(() => {
      const api = window.mascotSmoke.ref.current;
      api.stop();
      const before = api.getSnapshot();
      document.querySelector('[data-seam-mascot-hit]').dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 })
      );
      return { before, after: api.getSnapshot() };
    });
    assert.equal(settlingReaction.before.state, "settling");
    assert.equal(settlingReaction.after.reacting, true);
    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.reacting === false
    );

    await page.evaluate(() => window.mascotSmoke.ref.current.setDebugState("idle"));
    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.debugState === "idle" &&
        window.mascotSmoke.ref.current?.getSnapshot()?.morph === 0
    );
    const fixedIdleReaction = await page.evaluate(() => {
      document.querySelector('[data-seam-mascot-hit]').dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 })
      );
      return window.mascotSmoke.ref.current.getSnapshot();
    });
    assert.equal(fixedIdleReaction.state, "idle");
    assert.equal(fixedIdleReaction.debugState, "idle");
    assert.equal(fixedIdleReaction.reacting, true);
    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.reacting === false
    );
    const transformBefore = await page.locator('[data-seam-mascot] > g').getAttribute("transform");
    await page.waitForTimeout(500);
    const transformAfter = await page.locator('[data-seam-mascot] > g').getAttribute("transform");
    assert.notEqual(transformAfter, transformBefore, "Idle should breathe as a whole");

    await page.evaluate(() => window.mascotSmoke.ref.current.pause());
    assert.equal(
      await page.evaluate(() => window.mascotSmoke.ref.current.getSnapshot().state),
      "paused"
    );
    await page.evaluate(() => window.mascotSmoke.ref.current.resume());
    assert.notEqual(
      await page.evaluate(() => window.mascotSmoke.ref.current.getSnapshot().state),
      "paused"
    );

    assert.deepEqual(pageErrors, []);
    console.log("Browser motion smoke test passed");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
