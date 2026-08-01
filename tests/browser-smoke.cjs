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

    await page.evaluate(() => window.mascotSmoke.ref.current.setDebugState("idle"));
    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.debugState === "idle"
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
