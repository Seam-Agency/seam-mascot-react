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
  page.on("console", (message) => {
    if (message.type() === "error") console.error(message.text());
  });

  try {
    await page.setContent(
      '<style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}</style><div id="root"></div>'
    );
    await page.addScriptTag({ path: bundlePath });
    await page.waitForFunction(() => {
      const api = window.mascotSmoke?.ref.current;
      return api?.getSnapshot()?.state === "idle" &&
        document.querySelector('[data-seam-mascot] g > path')?.getAttribute("d") &&
        document.querySelector('[data-seam-dither-canvas]');
    });
    assert.equal(
      await page.locator('[data-seam-dither-canvas]').getAttribute("data-dither-status"),
      "ready",
      "Dither WebGL shader should initialize"
    );

    await page.evaluate(() =>
      window.mascotSmoke.ref.current.setIdleVariant("rest")
    );

    const initial = await page.evaluate(() => window.mascotSmoke.ref.current.getSnapshot());
    assert.equal(initial.state, "idle");
    assert.equal(initial.idleVariant, "rest");
    assert.equal(initial.idleVariantAmount, 0);
    assert.equal(initial.canReact, true);
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

    await page.evaluate(() =>
      window.mascotSmoke.ref.current.setIdleVariant("curious")
    );
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.idleVariant === "curious" &&
        snapshot.idleVariantAmount > 0.98 &&
        Math.abs(snapshot.curiousGaze) > 0.8;
    });
    const curiousIdle = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      const transform = machine.root.getAttribute("transform");
      const rotation = Number.parseFloat(
        transform.match(/rotate\(([-\d.]+)/)?.[1] ?? "0"
      );
      return {
        snapshot: machine.getSnapshot(),
        dataVariant: machine.root.dataset.idleVariant,
        dataGaze: machine.root.dataset.curiousGaze,
        rotation,
        eyeOffsetX:
          machine.geometry.eyeBuffers[0][0].x -
          machine.geometry.star.eyes[0][0].x
      };
    });
    assert.equal(curiousIdle.snapshot.state, "idle");
    assert.equal(curiousIdle.dataVariant, "curious");
    assert.ok(Math.abs(curiousIdle.rotation) > 2.5);
    assert.ok(Math.abs(curiousIdle.eyeOffsetX) > 1.5);
    assert.ok(Math.abs(curiousIdle.snapshot.curiousGaze) > 0.8);
    const initialGazeSign = Math.sign(curiousIdle.snapshot.curiousGaze);
    await page.waitForFunction((gazeSign) => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.idleVariant === "curious" &&
        snapshot.curiousGaze * gazeSign < -0.8;
    }, initialGazeSign);
    const oppositeCuriousGaze = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      return {
        gaze: machine.getSnapshot().curiousGaze,
        dataGaze: machine.root.dataset.curiousGaze,
        eyeOffsetX:
          machine.geometry.eyeBuffers[0][0].x -
          machine.geometry.star.eyes[0][0].x
      };
    });
    assert.equal(
      Math.sign(oppositeCuriousGaze.gaze),
      -initialGazeSign,
      "Curious gaze should alternate left and right"
    );
    assert.equal(
      Math.sign(oppositeCuriousGaze.eyeOffsetX),
      -Math.sign(curiousIdle.eyeOffsetX)
    );
    assert.notEqual(oppositeCuriousGaze.dataGaze, curiousIdle.dataGaze);

    await page.evaluate(() =>
      window.mascotSmoke.ref.current.setIdleVariant("auto")
    );
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.idleVariant !== "rest" &&
        snapshot.idleVariantAmount > 0.6;
    });
    const automaticIdle = await page.evaluate(() =>
      window.mascotSmoke.ref.current.getSnapshot()
    );
    assert.ok(
      ["curious", "squish", "float", "deep-breath"].includes(
        automaticIdle.idleVariant
      )
    );
    await page.evaluate(() =>
      window.mascotSmoke.ref.current.setIdleVariant("rest")
    );

    await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      machine.idleTipStates.forEach((state) => {
        state.active = false;
        state.pulse = 0;
        state.delay = 10000;
      });
      machine.ambientPulseDelay = 1;
    });
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.ambientPulsing && snapshot.ambientPulseAmount > 0.075;
    });
    const ambientPulseOutward = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      return {
        snapshot: machine.getSnapshot(),
        dataPulsing: machine.root.dataset.ambientPulsing,
        tipRatios: machine.idleTipModel.tips.map(({ tipIndex }) => {
          const source = machine.geometry.star.body[tipIndex];
          const current = machine.geometry.bodyBuffer[tipIndex];
          return Math.hypot(current.x, current.y) / Math.hypot(source.x, source.y);
        })
      };
    });
    assert.equal(ambientPulseOutward.snapshot.state, "idle");
    assert.equal(ambientPulseOutward.snapshot.reacting, false);
    assert.equal(ambientPulseOutward.dataPulsing, "true");
    assert.ok(ambientPulseOutward.tipRatios.every((ratio) => ratio > 1.06));

    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.ambientPulseAmount < -0.025
    );
    const ambientPulseInward = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      return machine.idleTipModel.tips.map(({ tipIndex }) => {
        const source = machine.geometry.star.body[tipIndex];
        const current = machine.geometry.bodyBuffer[tipIndex];
        return Math.hypot(current.x, current.y) / Math.hypot(source.x, source.y);
      });
    });
    assert.ok(ambientPulseInward.every((ratio) => ratio < 0.985));
    await page.waitForFunction(() =>
      window.mascotSmoke.ref.current?.getSnapshot()?.ambientPulsing === false
    );

    await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      const recording = {
        started: false,
        complete: false,
        maximumBlinkAmount: 0,
        minimumEyeHeights: machine.eyes.map(() => Number.POSITIVE_INFINITY),
        minimumReactionAmount: 0,
        inwardTipRatios: []
      };
      window.reactionRecording = recording;

      const sample = () => {
        const snapshot = machine.getSnapshot();
        if (snapshot.reacting) recording.started = true;

        if (recording.started) {
          recording.maximumBlinkAmount = Math.max(
            recording.maximumBlinkAmount,
            snapshot.blinkAmount
          );
          machine.eyes.forEach((eye, index) => {
            recording.minimumEyeHeights[index] = Math.min(
              recording.minimumEyeHeights[index],
              eye.getBBox().height
            );
          });

          if (snapshot.reactionAmount < recording.minimumReactionAmount) {
            recording.minimumReactionAmount = snapshot.reactionAmount;
            recording.inwardTipRatios = machine.idleTipModel.tips.map(
              ({ tipIndex }) => {
                const source = machine.geometry.star.body[tipIndex];
                const current = machine.geometry.bodyBuffer[tipIndex];
                return Math.hypot(current.x, current.y) /
                  Math.hypot(source.x, source.y);
              }
            );
          }
        }

        if (recording.started && !snapshot.reacting) {
          recording.complete = true;
          return;
        }
        requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    });
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

    await page.waitForFunction(() => window.reactionRecording?.complete);
    const reactionRemainder = await page.evaluate(() => window.reactionRecording);
    assert.ok(reactionRemainder.maximumBlinkAmount > 0.82);
    assert.ok(
      reactionRemainder.minimumEyeHeights.every(
        (height, index) => height < initialEyeHeights[index] * 0.3
      ),
      "Both eyes should blink in place"
    );
    assert.ok(reactionRemainder.minimumReactionAmount < -0.03);
    assert.ok(
      reactionRemainder.inwardTipRatios.every((ratio) => ratio < 0.985)
    );

    const visuallyIdleMovingReaction = await page.evaluate(() => {
      const api = window.mascotSmoke.ref.current;
      const machine = api.getMachine();
      machine.state = "moving";
      machine.root.dataset.state = "moving";
      machine.debugState = null;
      machine.hasTarget = true;
      machine.target.x = machine.position.x + 8;
      machine.target.y = machine.position.y;
      machine.velocity.x = 2;
      machine.velocity.y = 0;
      machine.speed = 2;
      machine.morph = 0.08;
      const before = api.getSnapshot();
      document.querySelector('[data-seam-mascot-hit]').dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 })
      );
      return { before, after: api.getSnapshot() };
    });
    assert.equal(visuallyIdleMovingReaction.before.state, "moving");
    assert.equal(visuallyIdleMovingReaction.before.canReact, true);
    assert.equal(visuallyIdleMovingReaction.after.reacting, true);
    assert.equal(visuallyIdleMovingReaction.after.hasTarget, false);
    assert.equal(visuallyIdleMovingReaction.after.speed, 0);
    assert.deepEqual(visuallyIdleMovingReaction.after.velocity, { x: 0, y: 0 });
    assert.equal(visuallyIdleMovingReaction.after.state, "settling");
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
    const trailSource = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      const tailModel = machine.facing === 1
        ? machine.tailModels.right
        : machine.tailModels.left;
      const tailTips = tailModel.tails.map(({ tipIndex }) =>
        machine.geometry.bodyBuffer[tipIndex]
      );
      return {
        source: { ...machine.trailSource },
        centerX: machine.position.x / 1200,
        facing: machine.facing,
        tailLocalX: (tailTips[0].x + tailTips[1].x) / 2
      };
    });
    assert.equal(trailSource.source.active, true);
    assert.ok(
      trailSource.facing === 1
        ? trailSource.source.x < trailSource.centerX
        : trailSource.source.x > trailSource.centerX,
      "Dither source should sit behind the mascot center"
    );
    assert.ok(
      trailSource.facing === 1
        ? trailSource.tailLocalX < 0
        : trailSource.tailLocalX > 0,
      "Detected tail midpoint should be rear-facing"
    );

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

    await page.evaluate(() => window.mascotSmoke.ref.current.stop());
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.state === "settling" && snapshot.canReact;
    });
    const settlingReaction = await page.evaluate(() => {
      const api = window.mascotSmoke.ref.current;
      const before = api.getSnapshot();
      document.querySelector('[data-seam-mascot-hit]').dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 })
      );
      return { before, after: api.getSnapshot() };
    });
    assert.equal(settlingReaction.before.state, "settling");
    assert.equal(settlingReaction.before.canReact, true);
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
