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
        document.querySelector('[data-seam-dither-canvas]') &&
        document.querySelector('[data-seam-mascot-bubble][data-ready="true"]');
    });
    assert.equal(
      await page.locator('[data-seam-dither-canvas]').getAttribute("data-dither-status"),
      "ready",
      "Dither WebGL shader should initialize"
    );
    assert.equal(
      await page.locator('[data-seam-dither-canvas]').getAttribute("data-dither-scale"),
      "0.72",
      "Dither footprint scale should reach the shader canvas"
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
    const initialBubble = await page.evaluate(() => {
      const bubble = document.querySelector('[data-seam-speech-bubble]');
      return {
        x: Number(bubble?.getAttribute("x")),
        y: Number(bubble?.getAttribute("y")),
        visible: bubble?.getAttribute("data-visible"),
        placement: bubble?.getAttribute("data-placement"),
        text: bubble?.textContent
      };
    });
    assert.equal(initialBubble.visible, "true");
    assert.equal(initialBubble.placement, "top");
    assert.match(initialBubble.text, /Hello from Seam/);
    assert.ok(Number.isFinite(initialBubble.x));
    assert.ok(Number.isFinite(initialBubble.y));
    const initialHtmlBubble = await page.evaluate(() => {
      const bubble = document.querySelector('[data-seam-mascot-bubble]');
      const surface = bubble?.querySelector('[data-seam-mascot-bubble-surface]');
      const rect = bubble?.getBoundingClientRect();
      return {
        visible: bubble?.getAttribute("data-visible"),
        motionState: bubble?.getAttribute("data-motion-state"),
        ready: bubble?.getAttribute("data-ready"),
        placement: bubble?.getAttribute("data-placement"),
        text: surface?.textContent,
        insideSvg: Boolean(bubble?.closest("svg")),
        left: rect?.left,
        top: rect?.top
      };
    });
    assert.equal(initialHtmlBubble.visible, "true");
    assert.equal(initialHtmlBubble.motionState, "open");
    assert.equal(initialHtmlBubble.ready, "true");
    assert.match(initialHtmlBubble.text, /Crisp HTML guide/);
    assert.equal(initialHtmlBubble.insideSvg, false);
    assert.ok(Number.isFinite(initialHtmlBubble.left));
    assert.ok(Number.isFinite(initialHtmlBubble.top));
    const initialHtmlBubbleAction = await page.evaluate(() => {
      const action = document.querySelector(
        '[data-seam-mascot-bubble-action]'
      );
      return {
        text: action?.textContent,
        customIcon: Boolean(action?.querySelector('[data-custom-icon]'))
      };
    });
    assert.match(initialHtmlBubbleAction.text, /Continue/);
    assert.equal(initialHtmlBubbleAction.customIcon, true);
    const initialTypewriter = await page.evaluate(() => {
      const typewriter = document.querySelector(
        '[data-seam-mascot-typewriter]'
      );
      return {
        state: typewriter?.getAttribute("data-typing-state"),
        height: typewriter?.getBoundingClientRect().height,
        visibleText: typewriter?.querySelector(
          '[data-seam-mascot-typewriter-output]'
        )?.textContent,
        fullText: typewriter?.getAttribute("aria-label")
      };
    });
    assert.notEqual(initialTypewriter.state, "complete");
    assert.ok(
      initialTypewriter.visibleText.length < initialTypewriter.fullText.length
    );
    await page.waitForFunction(() =>
      document.querySelector('[data-seam-mascot-typewriter]')
        ?.getAttribute("data-typing-state") === "complete"
    );
    const completedTypewriter = await page.evaluate(() => {
      const typewriter = document.querySelector(
        '[data-seam-mascot-typewriter]'
      );
      return {
        height: typewriter?.getBoundingClientRect().height,
        visibleText: typewriter?.querySelector(
          '[data-seam-mascot-typewriter-output]'
        )?.textContent,
        fullText: typewriter?.getAttribute("aria-label"),
        completions: window.mascotSmoke.typingCompletions
      };
    });
    assert.equal(completedTypewriter.visibleText, completedTypewriter.fullText);
    assert.equal(completedTypewriter.completions, 1);
    assert.ok(
      Math.abs(completedTypewriter.height - initialTypewriter.height) < 0.5,
      "Typewriter should reserve its final height before typing starts"
    );
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
    await page.waitForFunction((openEyeHeights) => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      const currentEyeHeights = Array.from(
        document.querySelectorAll('[data-seam-mascot] > g > path')
      ).slice(1).map((eye) => eye.getBBox().height);
      const blinkIsClosed = snapshot?.randomBlinking &&
        snapshot.blinkAmount > 0.75 &&
        currentEyeHeights.every(
          (height, index) => height < openEyeHeights[index] * 0.4
        );
      if (blinkIsClosed) {
        window.proceduralBlinkCapture = {
          snapshot,
          duration: window.mascotSmoke.ref.current.getMachine()
            .randomBlinkDuration,
          eyeHeights: currentEyeHeights
        };
      }
      return blinkIsClosed;
    }, initialEyeHeights);
    const proceduralBlink = await page.evaluate(
      () => window.proceduralBlinkCapture
    );
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

    await page.evaluate(() => {
      window.mascotSmoke.ref.current.setTypingFocus({ x: -0.92, y: -0.32 });
      window.mascotSmoke.ref.current.setIdleVariant("typing");
    });
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.idleVariant === "typing" &&
        snapshot.idleVariantAmount > 0.98 &&
        snapshot.randomBlinking === false;
    });
    const typingIdle = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      const centers = (eyes) => eyes.map((eye) => {
        const x = eye.map((point) => point.x);
        const y = eye.map((point) => point.y);
        return {
          centerX: (Math.max(...x) + Math.min(...x)) / 2,
          centerY: (Math.max(...y) + Math.min(...y)) / 2,
          height: Math.max(...y) - Math.min(...y)
        };
      });
      const eyes = centers(machine.geometry.eyeBuffers);
      const starEyes = centers(machine.geometry.star.eyes);
      return {
        snapshot: machine.getSnapshot(),
        dataVariant: machine.root.dataset.idleVariant,
        eyes,
        starEyes
      };
    });
    assert.equal(typingIdle.snapshot.state, "idle");
    assert.equal(typingIdle.dataVariant, "typing");
    assert.ok(typingIdle.snapshot.typingFocus.x < -0.85);
    assert.ok(typingIdle.snapshot.typingFocus.y < -0.25);
    assert.ok(
      typingIdle.eyes.every(
        (eye, index) =>
          eye.centerX - typingIdle.starEyes[index].centerX < -1.5 &&
          eye.height < initialEyeHeights[index] * 0.94 &&
          eye.height > initialEyeHeights[index] * 0.72
      ),
      "Typing eyes should hold their focus toward the reading surface"
    );
    const typingReadingSamples = await page.evaluate(() => new Promise(
      (resolve) => {
        const machine = window.mascotSmoke.ref.current.getMachine();
        const samples = [];
        const sample = () => {
          samples.push(machine.geometry.eyeBuffers.map((eye) => {
            const y = eye.map((point) => point.y);
            return (Math.max(...y) + Math.min(...y)) / 2;
          }));
          if (samples.length >= 120) {
            resolve(samples);
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
    ));
    const typingEyeRanges = [0, 1].map((eyeIndex) => {
      const values = typingReadingSamples.map((sample) => sample[eyeIndex]);
      return Math.max(...values) - Math.min(...values);
    });
    const typingEyeSyncError = Math.max(
      ...typingReadingSamples.map((sample) =>
        Math.abs(
          (sample[0] - typingReadingSamples[0][0]) -
          (sample[1] - typingReadingSamples[0][1])
        )
      )
    );
    assert.ok(
      typingEyeRanges.every((range) => range > 0.3),
      "Typing eyes should gently scan the reading surface vertically"
    );
    assert.ok(
      typingEyeSyncError < 0.08,
      "Typing eyes should read vertically together without alternating"
    );
    const typingReleaseSamples = await page.evaluate(() => new Promise(
      (resolve) => {
        window.mascotSmoke.ref.current.setIdleVariant("auto");
        const samples = [];
        const sample = () => {
          const snapshot = window.mascotSmoke.ref.current.getSnapshot();
          samples.push({
            variant: snapshot.idleVariant,
            amount: snapshot.idleVariantAmount
          });
          if (snapshot.idleVariant === "rest" || samples.length >= 30) {
            resolve(samples);
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
    ));
    assert.equal(typingReleaseSamples[0].variant, "typing");
    assert.ok(
      typingReleaseSamples.some(
        (sample) => sample.amount > 0.05 && sample.amount < 0.95
      ),
      "Typing expression should ease out before returning to procedural idle"
    );
    assert.equal(
      typingReleaseSamples[typingReleaseSamples.length - 1].variant,
      "rest"
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
      window.mascotSmoke.ref.current.setIdleVariant("bored")
    );
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.idleVariant === "bored" &&
        snapshot.idleVariantAmount > 0.98 &&
        Math.abs(snapshot.curiousGaze) > 0.8 &&
        snapshot.randomBlinking === false;
    });
    const boredIdle = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      const transform = machine.root.getAttribute("transform");
      const rotation = Number.parseFloat(
        transform.match(/rotate\(([-\d.]+)/)?.[1] ?? "0"
      );
      const eyes = machine.geometry.eyeBuffers.map((buffer, eyeIndex) => {
        const starEye = machine.geometry.star.eyes[eyeIndex];
        const starCenterY = (
          Math.min(...starEye.map((point) => point.y)) +
          Math.max(...starEye.map((point) => point.y))
        ) / 2;
        const upperEdge = buffer
          .filter((_, pointIndex) => starEye[pointIndex].y < starCenterY)
          .map((point) => point.y);
        const allY = buffer.map((point) => point.y);
        const allX = buffer.map((point) => point.x);
        const starX = starEye.map((point) => point.x);
        return {
          height: Math.max(...allY) - Math.min(...allY),
          upperEdgeRange: Math.max(...upperEdge) - Math.min(...upperEdge),
          centerOffsetX:
            (Math.max(...allX) + Math.min(...allX)) / 2 -
            (Math.max(...starX) + Math.min(...starX)) / 2
        };
      });
      return {
        snapshot: machine.getSnapshot(),
        dataVariant: machine.root.dataset.idleVariant,
        dataGaze: machine.root.dataset.curiousGaze,
        rotation,
        eyes
      };
    });
    assert.equal(boredIdle.snapshot.state, "idle");
    assert.equal(boredIdle.dataVariant, "bored");
    assert.ok(Math.abs(boredIdle.rotation) > 0.65);
    assert.ok(
      boredIdle.eyes.every(
        (eye, index) =>
          eye.height < initialEyeHeights[index] * 0.58 &&
          eye.height > initialEyeHeights[index] * 0.25 &&
          eye.upperEdgeRange < eye.height * 0.18 &&
          Math.abs(eye.centerOffsetX) > 1.2
      ),
      "Bored eyes should be half-lidded, flat on top, and looking aside"
    );
    const initialBoredGazeSign = Math.sign(boredIdle.snapshot.curiousGaze);
    await page.waitForFunction((gazeSign) => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.idleVariant === "bored" &&
        snapshot.curiousGaze * gazeSign < -0.8;
    }, initialBoredGazeSign);

    await page.evaluate(() =>
      window.mascotSmoke.ref.current.setIdleVariant("shy")
    );
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.idleVariant === "shy" &&
        snapshot.idleVariantAmount > 0.98 &&
        Math.abs(snapshot.curiousGaze) > 0.8 &&
        snapshot.randomBlinking === false;
    });
    const shyIdle = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      const centers = (eyes) => eyes.map((eye) => {
        const x = eye.map((point) => point.x);
        const y = eye.map((point) => point.y);
        return {
          x: (Math.max(...x) + Math.min(...x)) / 2,
          y: (Math.max(...y) + Math.min(...y)) / 2,
          height: Math.max(...y) - Math.min(...y)
        };
      });
      return {
        eyes: centers(machine.geometry.eyeBuffers),
        starEyes: centers(machine.geometry.star.eyes)
      };
    });
    const shyEyeDistance = Math.abs(shyIdle.eyes[1].x - shyIdle.eyes[0].x);
    const starEyeDistance = Math.abs(
      shyIdle.starEyes[1].x - shyIdle.starEyes[0].x
    );
    assert.ok(shyEyeDistance < starEyeDistance - 0.5);
    assert.ok(
      shyIdle.eyes.every(
        (eye, index) =>
          eye.y > shyIdle.starEyes[index].y + 0.75 &&
          eye.height < initialEyeHeights[index] * 0.9 &&
          eye.height > initialEyeHeights[index] * 0.65
      )
    );

    await page.evaluate(() =>
      window.mascotSmoke.ref.current.setIdleVariant("surprised")
    );
    await page.waitForFunction(() => {
      const snapshot = window.mascotSmoke.ref.current?.getSnapshot();
      return snapshot?.idleVariant === "surprised" &&
        snapshot.idleVariantAmount > 0.98 &&
        snapshot.randomBlinking === false;
    });
    const surprisedIdle = await page.evaluate(() => {
      const machine = window.mascotSmoke.ref.current.getMachine();
      const bounds = (eyes) => eyes.map((eye) => {
        const x = eye.map((point) => point.x);
        const y = eye.map((point) => point.y);
        return {
          centerX: (Math.max(...x) + Math.min(...x)) / 2,
          width: Math.max(...x) - Math.min(...x),
          height: Math.max(...y) - Math.min(...y)
        };
      });
      return {
        eyes: bounds(machine.geometry.eyeBuffers),
        starEyes: bounds(machine.geometry.star.eyes)
      };
    });
    const surprisedEyeDistance = Math.abs(
      surprisedIdle.eyes[1].centerX - surprisedIdle.eyes[0].centerX
    );
    const surprisedStarDistance = Math.abs(
      surprisedIdle.starEyes[1].centerX -
      surprisedIdle.starEyes[0].centerX
    );
    assert.ok(surprisedEyeDistance > surprisedStarDistance + 0.7);
    assert.ok(
      surprisedIdle.eyes.every(
        (eye, index) =>
          eye.height > surprisedIdle.starEyes[index].height * 1.2 &&
          eye.width > surprisedIdle.starEyes[index].width * 1.08
      )
    );

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
      [
        "curious",
        "bored",
        "shy",
        "surprised",
        "squish",
        "float",
        "deep-breath"
      ].includes(
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
    const movingBubble = await page.evaluate(() => {
      const bubble = document.querySelector('[data-seam-speech-bubble]');
      return {
        x: Number(bubble?.getAttribute("x")),
        y: Number(bubble?.getAttribute("y")),
        placement: bubble?.getAttribute("data-placement")
      };
    });
    assert.ok(
      Math.hypot(
        movingBubble.x - initialBubble.x,
        movingBubble.y - initialBubble.y
      ) > 40,
      "Speech bubble should follow the mascot position"
    );
    assert.ok(
      ["top", "right", "bottom", "left"].includes(movingBubble.placement)
    );
    const movingHtmlBubble = await page.evaluate(() => {
      const rect = document
        .querySelector('[data-seam-mascot-bubble]')
        ?.getBoundingClientRect();
      return { left: rect?.left, top: rect?.top };
    });
    assert.ok(
      Math.hypot(
        movingHtmlBubble.left - initialHtmlBubble.left,
        movingHtmlBubble.top - initialHtmlBubble.top
      ) > 40,
      "HTML bubble should follow the mascot's stable position"
    );
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
    const htmlBubbleBefore = await page.locator('[data-seam-mascot-bubble]').evaluate(
      (element) => ({ left: element.style.left, top: element.style.top })
    );
    await page.waitForTimeout(500);
    const transformAfter = await page.locator('[data-seam-mascot] > g').getAttribute("transform");
    const htmlBubbleAfter = await page.locator('[data-seam-mascot-bubble]').evaluate(
      (element) => ({ left: element.style.left, top: element.style.top })
    );
    assert.notEqual(transformAfter, transformBefore, "Idle should breathe as a whole");
    assert.deepEqual(
      htmlBubbleAfter,
      htmlBubbleBefore,
      "HTML bubble must not inherit idle breathing motion"
    );

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
