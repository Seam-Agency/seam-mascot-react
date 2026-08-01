// Generated from output/socially-mascot-morph/mascot-machine.js.
// Run `npm run sync:workspace` after changing the demo engine.

const STATES = Object.freeze({
  IDLE: "idle",
  LAUNCHING: "launching",
  MOVING: "moving",
  SETTLING: "settling",
  PAUSED: "paused"
});

const DEBUG_MORPH_TARGETS = Object.freeze({
  [STATES.IDLE]: 0,
  [STATES.LAUNCHING]: 0.55,
  [STATES.MOVING]: 1,
  [STATES.SETTLING]: 0.28
});

// Keep click eligibility aligned with the shape the user can actually see.
// Below this amount the mascot still reads as its idle star form, even when
// a nearby pointer target keeps the runtime state labelled as moving.
const REACTION_MORPH_THRESHOLD = 0.18;
// Pull the trail origin away from the sharp tail tips so the dither appears
// to emerge from inside the moving silhouette rather than touch its edge.
const DITHER_TRAIL_TIP_INSET = 0.24;

const IDLE_VARIANTS = Object.freeze([
  "curious",
  "squish",
  "float",
  "deep-breath"
]);
const IDLE_VARIANT_VALUES = Object.freeze(["rest", ...IDLE_VARIANTS]);
const IDLE_VARIANT_PROFILES = Object.freeze({
  curious: Object.freeze({
    attack: 500,
    holdMinimum: 1600,
    holdMaximum: 2600,
    release: 500
  }),
  squish: Object.freeze({
    attack: 350,
    holdMinimum: 450,
    holdMaximum: 850,
    release: 500
  }),
  float: Object.freeze({
    attack: 500,
    holdMinimum: 1300,
    holdMaximum: 2200,
    release: 500
  }),
  "deep-breath": Object.freeze({
    attack: 500,
    holdMinimum: 1500,
    holdMaximum: 2400,
    release: 500
  })
});

const EVENTS = Object.freeze({
  FOLLOW: "FOLLOW",
  MOVE_TO: "MOVE_TO",
  MOVE_LEFT: "MOVE_LEFT",
  MOVE_RIGHT: "MOVE_RIGHT",
  STOP: "STOP",
  IDLE: "IDLE",
  REACT: "REACT",
  PAUSE: "PAUSE",
  RESUME: "RESUME",
  TOGGLE_PAUSE: "TOGGLE_PAUSE"
});

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (from, to, progress) => from + (to - from) * progress;

function smoothstep(progress) {
  const value = clamp01(progress);
  return value * value * (3 - 2 * value);
}

function smootherstep(progress) {
  const value = clamp01(progress);
  return value * value * value * (
    value * (value * 6 - 15) + 10
  );
}

// transitions.dev --ease-smooth-out: cubic-bezier(0.22, 1, 0.36, 1)
function smoothOut(progress) {
  const x = clamp01(progress);
  let lower = 0;
  let upper = 1;
  let t = x;

  for (let index = 0; index < 8; index += 1) {
    t = (lower + upper) / 2;
    const inverse = 1 - t;
    const curveX =
      3 * inverse * inverse * t * 0.22 +
      3 * inverse * t * t * 0.36 +
      t * t * t;
    if (curveX < x) lower = t;
    else upper = t;
  }

  const inverse = 1 - t;
  return 3 * inverse * inverse * t + 3 * inverse * t * t + t * t * t;
}

function readDuration(variableName, fallback) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return Number.parseFloat(raw);
  if (raw.endsWith("s")) return Number.parseFloat(raw) * 1000;
  return fallback;
}

function readNumber(variableName, fallback) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function samplePath(path, count) {
  const totalLength = path.getTotalLength();
  const points = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const point = path.getPointAtLength((totalLength * index) / count);
    points[index] = { x: point.x, y: point.y };
  }
  return points;
}

function getPointBounds(points) {
  let minimumX = Infinity;
  let minimumY = Infinity;
  let maximumX = -Infinity;
  let maximumY = -Infinity;

  for (const point of points) {
    minimumX = Math.min(minimumX, point.x);
    minimumY = Math.min(minimumY, point.y);
    maximumX = Math.max(maximumX, point.x);
    maximumY = Math.max(maximumY, point.y);
  }

  return {
    minimumX,
    minimumY,
    maximumX,
    maximumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
    centerX: (minimumX + maximumX) / 2,
    centerY: (minimumY + maximumY) / 2
  };
}

function signedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function rotateToRightmost(points) {
  let rightmostIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    const candidate = points[index];
    const current = points[rightmostIndex];
    if (candidate.x > current.x || (candidate.x === current.x && candidate.y < current.y)) {
      rightmostIndex = index;
    }
  }
  return points.slice(rightmostIndex).concat(points.slice(0, rightmostIndex));
}

function alignDirection(reference, candidate) {
  const sameDirection = Math.sign(signedArea(reference)) === Math.sign(signedArea(candidate));
  return rotateToRightmost(sameDirection ? candidate : candidate.slice().reverse());
}

function mirrorHorizontally(points) {
  return points.map((point) => ({ x: -point.x, y: point.y }));
}

function normalizeShape(bodyPath, eyePaths, options) {
  const rawBody = samplePath(bodyPath, options.bodySamples);
  const bounds = getPointBounds(rawBody);
  const scale = options.targetHeight / bounds.height;
  const normalize = (point) => ({
    x: (point.x - bounds.centerX) * scale,
    y: (point.y - bounds.centerY) * scale
  });

  return {
    body: rotateToRightmost(rawBody.map(normalize)),
    eyes: eyePaths.map((path) =>
      rotateToRightmost(samplePath(path, options.eyeSamples).map(normalize))
    )
  };
}

function createTurnBridge(star, targetHeight) {
  const radiusX = targetHeight * 0.43;
  const radiusY = targetHeight * 0.465;

  return {
    body: star.body.map((point) => {
      const angle = Math.atan2(point.y, point.x);
      const organicOffset = 1 + Math.cos(angle * 3 + 0.35) * 0.018;
      return {
        x: Math.cos(angle) * radiusX * organicOffset,
        y: Math.sin(angle) * radiusY / organicOffset
      };
    }),
    eyes: star.eyes.map((eye) =>
      eye.map((point) => ({
        x: point.x * 0.82,
        y: point.y * 0.86
      }))
    )
  };
}

function formatNumber(value, precision = 2) {
  const factor = 10 ** precision;
  return String(Math.round(value * factor) / factor);
}

function smoothClosedPath(points) {
  const count = points.length;
  const first = points[0];
  const last = points[count - 1];
  let path =
    "M" +
    formatNumber((last.x + first.x) / 2) +
    " " +
    formatNumber((last.y + first.y) / 2);

  for (let index = 0; index < count; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % count];
    path +=
      "Q" +
      formatNumber(current.x) +
      " " +
      formatNumber(current.y) +
      " " +
      formatNumber((current.x + next.x) / 2) +
      " " +
      formatNumber((current.y + next.y) / 2);
  }

  return path + "Z";
}

function createBuffer(length) {
  return Array.from({ length }, () => ({ x: 0, y: 0 }));
}

function circularIndexDistance(from, to, count) {
  const direct = Math.abs(from - to);
  return Math.min(direct, count - direct);
}

function createTailModel(points, facing) {
  const count = points.length;
  const rearward = points.map((point) => -point.x * facing);
  const candidates = [];

  for (let index = 0; index < count; index += 1) {
    const previous = rearward[(index - 1 + count) % count];
    const next = rearward[(index + 1) % count];
    if (rearward[index] >= previous && rearward[index] >= next) {
      candidates.push(index);
    }
  }

  candidates.sort((first, second) => rearward[second] - rearward[first]);
  const minimumSeparation = Math.max(5, Math.round(count * 0.08));
  const tipIndices = [];

  for (const candidate of candidates) {
    const isSeparate = tipIndices.every(
      (tipIndex) =>
        circularIndexDistance(candidate, tipIndex, count) >= minimumSeparation
    );
    if (isSeparate) tipIndices.push(candidate);
    if (tipIndices.length === 2) break;
  }

  if (tipIndices.length !== 2) {
    throw new Error("MascotStateMachine: could not detect two tail tips.");
  }

  const influenceRadius = Math.max(3, Math.round(count * 0.055));
  const anchorOffset = influenceRadius + 1;

  return {
    retractionMaximum: 0.42,
    tails: tipIndices
      .sort((first, second) => points[first].y - points[second].y)
      .map((tipIndex, tailIndex) => {
        const before = points[(tipIndex - anchorOffset + count) % count];
        const after = points[(tipIndex + anchorOffset) % count];
        return {
          tipIndex,
          phase: tailIndex * Math.PI,
          anchor: {
            x: (before.x + after.x) / 2,
            y: (before.y + after.y) / 2
          },
          influence: points.map((point, pointIndex) => {
            const distance = circularIndexDistance(
              pointIndex,
              tipIndex,
              count
            );
            return distance > influenceRadius
              ? 0
              : smoothstep(1 - distance / (influenceRadius + 1));
          })
        };
      })
  };
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function shuffle(values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createIdleTipModel(points) {
  const count = points.length;
  const radii = points.map((point) => Math.hypot(point.x, point.y));
  const minimumRadius = Math.min(...radii);
  const maximumRadius = Math.max(...radii);
  const tipThreshold = lerp(minimumRadius, maximumRadius, 0.58);
  const tipIndices = [];

  for (let index = 0; index < count; index += 1) {
    const radius = radii[index];
    const previous = radii[(index - 1 + count) % count];
    const next = radii[(index + 1) % count];
    if (radius >= tipThreshold && radius >= previous && radius >= next) {
      tipIndices.push(index);
    }
  }

  if (tipIndices.length < 3) {
    throw new Error("MascotStateMachine: could not detect idle spike tips.");
  }

  const influenceRadius = Math.max(
    2,
    Math.floor(count / (tipIndices.length * 3))
  );

  return {
    maximumConcurrent: Math.min(3, tipIndices.length),
    tips: tipIndices.map((tipIndex) => ({
      tipIndex,
      influence: points.map((point, pointIndex) => {
        const distance = circularIndexDistance(pointIndex, tipIndex, count);
        return distance > influenceRadius
          ? 0
          : smoothstep(1 - distance / (influenceRadius + 1));
      })
    }))
  };
}

function limitVector(x, y, maximum) {
  const length = Math.hypot(x, y);
  if (length <= maximum || length === 0) return { x, y };
  const scale = maximum / length;
  return { x: x * scale, y: y * scale };
}

function shortestAngle(from, to) {
  let difference = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

class MascotStateMachine {
  constructor(options) {
    if (!options?.root || !options?.body || !options?.eyes?.length) {
      throw new Error("MascotStateMachine: root, body, and eyes are required.");
    }
    if (!options?.sources?.star?.body || !options?.sources?.motion?.body) {
      throw new Error("MascotStateMachine: star and motion SVG sources are required.");
    }

    this.root = options.root;
    this.body = options.body;
    this.eyes = options.eyes;
    this.speechBubble = options.speechBubble?.element
      ? {
          element: options.speechBubble.element,
          placement: ["auto", "top", "right", "bottom", "left"].includes(
            options.speechBubble.placement
          )
            ? options.speechBubble.placement
            : "auto",
          width: Math.max(112, options.speechBubble.width ?? 220),
          height: Math.max(58, options.speechBubble.height ?? 104),
          offset: Math.max(6, options.speechBubble.offset ?? 18)
        }
      : null;
    this.bounds = {
      minimumX: options.bounds?.minimumX ?? 70,
      maximumX: options.bounds?.maximumX ?? 1130,
      minimumY: options.bounds?.minimumY ?? 70,
      maximumY: options.bounds?.maximumY ?? 530
    };

    this.timing = {
      morphIn: options.timing?.morphIn ??
        readDuration("--mascot-morph-in-duration", 250),
      morphOut: options.timing?.morphOut ??
        readDuration("--mascot-morph-out-duration", 150),
      turn: options.timing?.turn ??
        readDuration("--mascot-turn-duration", 280),
      idleCycle: options.timing?.idleCycle ??
        readDuration("--mascot-idle-cycle", 2200),
      breathCycle: options.timing?.breathCycle ??
        readDuration("--mascot-breath-cycle", 3000),
      reaction: options.timing?.reaction ??
        readDuration("--mascot-reaction-duration", 400),
      idleReveal: options.timing?.idleReveal ??
        readDuration("--duration-medium", 350)
    };

    this.idleMotion = {
      breathAmplitude: options.idleMotion?.breathAmplitude ??
        readNumber("--mascot-breath-amplitude", 0.055),
      baseAmplitude: options.idleMotion?.baseAmplitude ??
        readNumber("--mascot-idle-base-amplitude", 0.01),
      tipAmplitude: options.idleMotion?.tipAmplitude ??
        readNumber("--mascot-idle-tip-amplitude", 0.105),
      rippleAmplitude: options.idleMotion?.rippleAmplitude ??
        readNumber("--mascot-idle-ripple-amplitude", 0.018),
      tipSpeed: Math.max(
        0.25,
        options.idleMotion?.tipSpeed ??
          readNumber("--mascot-idle-tip-speed", 1.45)
      ),
      blinkMinimumDelay: Math.max(
        500,
        options.idleMotion?.blinkMinimumDelay ??
          readDuration("--mascot-blink-min-delay", 1800)
      ),
      blinkMaximumDelay: Math.max(
        500,
        options.idleMotion?.blinkMaximumDelay ??
          readDuration("--mascot-blink-max-delay", 5200)
      ),
      blinkMinimumDuration: Math.max(
        80,
        options.idleMotion?.blinkMinimumDuration ??
          readDuration("--mascot-blink-min-duration", 110)
      ),
      blinkMaximumDuration: Math.max(
        80,
        options.idleMotion?.blinkMaximumDuration ??
          readDuration("--mascot-blink-max-duration", 180)
      ),
      doubleBlinkChance: clamp01(
        options.idleMotion?.doubleBlinkChance ??
          readNumber("--mascot-double-blink-chance", 0.18)
      ),
      variantStrength: clamp(
        options.idleMotion?.variantStrength ??
          readNumber("--mascot-idle-variant-strength", 1),
        0,
        2
      ),
      variantMinimumDelay: Math.max(
        500,
        options.idleMotion?.variantMinimumDelay ??
          readDuration("--mascot-idle-variant-min-delay", 1800)
      ),
      variantMaximumDelay: Math.max(
        500,
        options.idleMotion?.variantMaximumDelay ??
          readDuration("--mascot-idle-variant-max-delay", 4200)
      ),
      pulseStrength: clamp(
        options.idleMotion?.pulseStrength ??
          readNumber("--mascot-idle-pulse-strength", 0.78),
        0,
        2
      ),
      pulseMinimumDelay: Math.max(
        1000,
        options.idleMotion?.pulseMinimumDelay ??
          readDuration("--mascot-idle-pulse-min-delay", 4800)
      ),
      pulseMaximumDelay: Math.max(
        1000,
        options.idleMotion?.pulseMaximumDelay ??
          readDuration("--mascot-idle-pulse-max-delay", 9000)
      ),
      pulseDuration: Math.max(
        250,
        options.idleMotion?.pulseDuration ??
          readDuration("--mascot-idle-pulse-duration", 500)
      )
    };
    this.idleMotion.blinkMaximumDelay = Math.max(
      this.idleMotion.blinkMinimumDelay,
      this.idleMotion.blinkMaximumDelay
    );
    this.idleMotion.blinkMaximumDuration = Math.max(
      this.idleMotion.blinkMinimumDuration,
      this.idleMotion.blinkMaximumDuration
    );
    this.idleMotion.variantMaximumDelay = Math.max(
      this.idleMotion.variantMinimumDelay,
      this.idleMotion.variantMaximumDelay
    );
    this.idleMotion.pulseMaximumDelay = Math.max(
      this.idleMotion.pulseMinimumDelay,
      this.idleMotion.pulseMaximumDelay
    );

    this.physics = {
      stiffness: options.physics?.stiffness ?? 30,
      damping: options.physics?.damping ?? 10.8,
      maximumSpeed: options.physics?.maximumSpeed ?? 900,
      maximumAcceleration: options.physics?.maximumAcceleration ?? 2800,
      arrivalRadius: options.physics?.arrivalRadius ?? 6,
      stopSpeed: options.physics?.stopSpeed ?? 12,
      headingResponse: options.physics?.headingResponse ?? 13,
      idleDrag: options.physics?.idleDrag ?? 13
    };

    this.tailMotion = {
      minimumRate: options.tailMotion?.minimumRate ?? 3.2,
      maximumRate: options.tailMotion?.maximumRate ?? 11.5,
      response: options.tailMotion?.response ?? 6.5
    };

    const geometryOptions = {
      bodySamples: options.bodySamples ?? 72,
      eyeSamples: options.eyeSamples ?? 24,
      targetHeight: options.targetHeight ?? 92
    };
    this.targetHeight = geometryOptions.targetHeight;
    const star = normalizeShape(
      options.sources.star.body,
      options.sources.star.eyes,
      geometryOptions
    );
    const motionRight = normalizeShape(
      options.sources.motion.body,
      options.sources.motion.eyes,
      geometryOptions
    );
    const motionScale = clamp(options.motionScale ?? 1, 0.5, 1.25);
    motionRight.body = motionRight.body.map((point) => ({
      x: point.x * motionScale,
      y: point.y * motionScale
    }));
    motionRight.eyes = motionRight.eyes.map((eye) =>
      eye.map((point) => ({
        x: point.x * motionScale,
        y: point.y * motionScale
      }))
    );
    motionRight.body = alignDirection(star.body, motionRight.body);
    motionRight.eyes = motionRight.eyes.map((eye, index) =>
      alignDirection(star.eyes[index], eye)
    );
    const motionLeft = {
      body: alignDirection(
        star.body,
        mirrorHorizontally(motionRight.body)
      ),
      eyes: [
        alignDirection(
          star.eyes[0],
          mirrorHorizontally(motionRight.eyes[1])
        ),
        alignDirection(
          star.eyes[1],
          mirrorHorizontally(motionRight.eyes[0])
        )
      ]
    };

    this.geometry = {
      star,
      motion: { right: motionRight, left: motionLeft },
      turnBridge: createTurnBridge(
        star,
        geometryOptions.targetHeight * motionScale
      ),
      bodyBuffer: createBuffer(geometryOptions.bodySamples),
      eyeBuffers: [
        createBuffer(geometryOptions.eyeSamples),
        createBuffer(geometryOptions.eyeSamples)
      ]
    };
    this.tailModels = {
      right: createTailModel(motionRight.body, 1),
      left: createTailModel(motionLeft.body, -1)
    };
    const starBounds = getPointBounds(star.body);
    this.morphModel = {
      halfWidth: Math.max(
        Math.abs(starBounds.minimumX),
        Math.abs(starBounds.maximumX)
      ),
      bodyWave: 0.09,
      eyeDelay: 0.045
    };
    this.idleTipModel = createIdleTipModel(star.body);
    this.idleTipStates = this.idleTipModel.tips.map(() => ({
      active: false,
      delay: 0,
      elapsed: 0,
      attackDuration: 700,
      releaseDuration: 900,
      attackCurve: 1,
      releaseCurve: 1,
      depth: 1,
      spread: 1,
      detail: 0.5,
      pulse: 0
    }));

    const initial = options.initialPosition ?? {
      x: (this.bounds.minimumX + this.bounds.maximumX) / 2,
      y: (this.bounds.minimumY + this.bounds.maximumY) / 2
    };

    this.state = STATES.IDLE;
    this.previousState = STATES.IDLE;
    this.position = {
      x: clamp(initial.x, this.bounds.minimumX, this.bounds.maximumX),
      y: clamp(initial.y, this.bounds.minimumY, this.bounds.maximumY)
    };
    this.target = { ...this.position };
    this.velocity = { x: 0, y: 0 };
    this.speed = 0;
    this.heading = 0;
    this.visualTilt = 0;
    this.facing = 1;
    this.pendingFacing = 0;
    this.turnFromFacing = 1;
    this.turnElapsed = 0;
    this.turnProgress = 0;
    this.turning = false;
    this.morph = 0;
    this.hasTarget = false;
    this.debugState = null;
    this.idleElapsed = 0;
    this.idleVariantMode = IDLE_VARIANT_VALUES.includes(options.idleVariant)
      ? options.idleVariant
      : "auto";
    this.idleVariant = "rest";
    this.previousIdleVariant = "rest";
    this.idleVariantPhase = "waiting";
    this.idleVariantElapsed = 0;
    this.idleVariantMotionElapsed = 0;
    this.idleVariantDelay = 0;
    this.idleVariantAmount = 0;
    this.idleVariantDirection = Math.random() < 0.5 ? -1 : 1;
    this.idleVariantAttackDuration = 500;
    this.idleVariantHoldDuration = 1000;
    this.idleVariantReleaseDuration = 500;
    this.curiousGaze = 0;
    this.curiousGazeFrom = 0;
    this.curiousGazeTarget = 0;
    this.curiousGazeElapsed = 0;
    this.curiousGazeDuration = 500;
    this.curiousGazeDelay = 0;
    this.curiousGazeMoving = false;
    this.ambientPulseActive = false;
    this.ambientPulseElapsed = 0;
    this.ambientPulseDelay = 0;
    this.ambientPulseAmount = 0;
    this.reactionElapsed = 0;
    this.reactionProgress = 0;
    this.reactionAmount = 0;
    this.blinkAmount = 0;
    this.reacting = false;
    this.randomBlinkActive = false;
    this.randomBlinkElapsed = 0;
    this.randomBlinkDelay = 0;
    this.trailSource = options.trailSource ?? null;
    this.randomBlinkDuration = 140;
    this.randomBlinkAmount = 0;
    this.pendingRandomBlinks = 0;
    this.tailPhase = 0;
    this.tailRate = this.tailMotion.minimumRate;
    this.listeners = new Set();
    this.frame = 0;
    this.lastFrameTime = 0;
    this.started = false;
    this.destroyed = false;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.resetIdleTips();
    this.resetIdleVariant();
    this.scheduleAmbientPulse();
    this.scheduleRandomBlink();

    this.tick = this.tick.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.root.dataset.state = STATES.IDLE;
    this.root.dataset.reacting = "false";
    this.root.dataset.blinking = "false";
    this.root.dataset.idleVariant = this.idleVariant;
    this.root.dataset.curiousGaze = "center";
    this.root.dataset.ambientPulsing = "false";
    this.render();
  }

  start() {
    if (this.destroyed || this.started) return this;
    this.started = true;
    this.lastFrameTime = performance.now();
    this.queueFrame();
    return this;
  }

  destroy() {
    this.destroyed = true;
    this.started = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.listeners.clear();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return Object.freeze({
      state: this.state,
      previousState: this.previousState,
      position: Object.freeze({ ...this.position }),
      target: Object.freeze({ ...this.target }),
      velocity: Object.freeze({ ...this.velocity }),
      speed: this.speed,
      heading: this.heading,
      visualTilt: this.visualTilt,
      facing: this.facing,
      turning: this.turning,
      turnProgress: this.turnProgress,
      pendingFacing: this.pendingFacing,
      tailRate: this.tailRate,
      morph: this.morph,
      hasTarget: this.hasTarget,
      canReact: this.canPlayReaction(),
      reacting: this.reacting,
      reactionProgress: this.reactionProgress,
      reactionAmount: this.reactionAmount,
      blinkAmount: Math.max(this.blinkAmount, this.randomBlinkAmount),
      randomBlinking: this.randomBlinkActive,
      idleVariant: this.idleVariant,
      idleVariantAmount: this.idleVariantAmount,
      curiousGaze: this.curiousGaze,
      ambientPulsing: this.ambientPulseActive,
      ambientPulseAmount: this.ambientPulseAmount,
      debugState: this.debugState
    });
  }

  send(event, payload = {}) {
    const type = typeof event === "string" ? event : event?.type;
    const data = typeof event === "string" ? payload : event ?? {};

    switch (type) {
      case EVENTS.FOLLOW:
        return this.follow(data.x, data.y);
      case EVENTS.MOVE_TO:
        return this.moveTo(data, data);
      case EVENTS.MOVE_LEFT:
        return this.follow(this.bounds.minimumX, this.position.y);
      case EVENTS.MOVE_RIGHT:
        return this.follow(this.bounds.maximumX, this.position.y);
      case EVENTS.STOP:
      case EVENTS.IDLE:
        return this.settle();
      case EVENTS.REACT:
        return this.playReaction();
      case EVENTS.PAUSE:
        return this.pause();
      case EVENTS.RESUME:
        return this.resume();
      case EVENTS.TOGGLE_PAUSE:
        return this.state === STATES.PAUSED ? this.resume() : this.pause();
      default:
        throw new Error("MascotStateMachine: unknown event: " + type);
    }
  }

  setState(nextState, options = {}) {
    if (options.static === true) return this.setDebugState(nextState);

    switch (nextState) {
      case STATES.IDLE:
      case STATES.SETTLING:
        return this.settle();
      case STATES.LAUNCHING:
      case STATES.MOVING:
        return this.moveTo(options);
      case STATES.PAUSED:
        return this.pause();
      default:
        throw new Error("MascotStateMachine: unknown state: " + nextState);
    }
  }

  setDebugState(nextState) {
    if (nextState == null || nextState === "auto") {
      const wasDebugging = this.debugState !== null;
      this.debugState = null;
      const nextRuntimeState = this.morph > 0.001
        ? STATES.SETTLING
        : STATES.IDLE;
      const stateChanged = this.state !== nextRuntimeState;
      this.changeState(nextRuntimeState);
      if (wasDebugging && !stateChanged) this.emit();
      this.lastFrameTime = performance.now();
      this.queueFrame();
      return this;
    }

    if (!(nextState in DEBUG_MORPH_TARGETS)) {
      throw new Error(
        "MascotStateMachine: unsupported debug state: " + nextState
      );
    }

    this.debugState = nextState;
    this.hasTarget = false;
    this.target.x = this.position.x;
    this.target.y = this.position.y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.speed = 0;
    this.visualTilt = 0;
    this.pendingFacing = 0;
    this.turnFromFacing = this.facing;
    this.turnElapsed = 0;
    this.turnProgress = 0;
    this.turning = false;
    const stateChanged = this.state !== nextState;
    this.changeState(nextState);
    if (!stateChanged) this.emit();
    if (this.reducedMotion.matches) {
      this.morph = DEBUG_MORPH_TARGETS[nextState];
      this.render();
      return this;
    }
    this.lastFrameTime = performance.now();
    this.queueFrame();
    return this;
  }

  setIdleVariant(nextVariant) {
    const normalized = nextVariant ?? "auto";
    if (
      normalized !== "auto" &&
      !IDLE_VARIANT_VALUES.includes(normalized)
    ) {
      throw new Error(
        "MascotStateMachine: unsupported idle variant: " + normalized
      );
    }

    if (this.idleVariantMode === normalized) return this;
    this.idleVariantMode = normalized;
    if (
      this.state === STATES.IDLE &&
      !this.reacting &&
      !this.reducedMotion.matches
    ) {
      this.resetIdleVariant();
    } else {
      this.cancelIdleVariant();
    }
    this.emit();
    this.render();
    this.lastFrameTime = performance.now();
    this.queueFrame();
    return this;
  }

  follow(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return this;
    if (this.reacting) return this;
    if (this.debugState !== null) return this;
    this.target.x = clamp(x, this.bounds.minimumX, this.bounds.maximumX);
    this.target.y = clamp(y, this.bounds.minimumY, this.bounds.maximumY);

    if (this.reducedMotion.matches) {
      this.position.x = this.target.x;
      this.position.y = this.target.y;
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.speed = 0;
      this.morph = 0;
      this.hasTarget = false;
      this.changeState(STATES.IDLE);
      this.render();
      return this;
    }

    const distance = Math.hypot(
      this.target.x - this.position.x,
      this.target.y - this.position.y
    );
    if (distance > this.physics.arrivalRadius) {
      this.hasTarget = true;
      if (this.state === STATES.IDLE || this.state === STATES.SETTLING) {
        this.changeState(STATES.LAUNCHING);
      }
    }
    this.queueFrame();
    return this;
  }

  moveTo(target, options = {}) {
    if (typeof target === "number") {
      const x = options.unit === "svg"
        ? target
        : lerp(this.bounds.minimumX, this.bounds.maximumX, clamp01(target));
      const y = options.y ?? this.position.y;
      return this.follow(x, y);
    }

    const data = target ?? {};
    const usesSvgUnits = data.unit === "svg" || options.unit === "svg";
    const currentYProgress =
      (this.position.y - this.bounds.minimumY) /
      (this.bounds.maximumY - this.bounds.minimumY);
    const xValue = data.x ?? data.progressX ?? data.progress ?? 0.5;
    const yValue = data.y ?? data.progressY ?? currentYProgress;
    const x = usesSvgUnits
      ? xValue
      : lerp(this.bounds.minimumX, this.bounds.maximumX, clamp01(xValue));
    const y = usesSvgUnits
      ? yValue
      : lerp(this.bounds.minimumY, this.bounds.maximumY, clamp01(yValue));
    return this.follow(x, y);
  }

  settle() {
    this.hasTarget = false;
    this.target.x = this.position.x;
    this.target.y = this.position.y;
    if (this.state !== STATES.PAUSED && (this.speed > 0.5 || this.morph > 0.001)) {
      this.changeState(STATES.SETTLING);
    } else if (this.state !== STATES.PAUSED) {
      this.changeState(STATES.IDLE);
    }
    this.queueFrame();
    return this;
  }

  canPlayReaction() {
    if (
      this.destroyed ||
      this.reacting ||
      this.state === STATES.PAUSED ||
      this.reducedMotion.matches
    ) {
      return false;
    }

    if (this.debugState !== null) {
      return this.debugState === STATES.IDLE;
    }

    return !this.turning && this.morph <= REACTION_MORPH_THRESHOLD;
  }

  playReaction() {
    if (!this.canPlayReaction()) return this;

    this.reacting = true;
    this.reactionElapsed = 0;
    this.reactionProgress = 0;
    this.reactionAmount = 0;
    this.blinkAmount = 0;
    this.root.dataset.reacting = "true";
    this.cancelIdleVariant();
    this.cancelAmbientPulse();

    if (this.debugState === null) {
      this.hasTarget = false;
      this.target.x = this.position.x;
      this.target.y = this.position.y;
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.speed = 0;
      this.visualTilt = 0;
      this.pendingFacing = 0;
      this.changeState(
        this.morph > 0.001 ? STATES.SETTLING : STATES.IDLE
      );
    }

    this.scheduleRandomBlink();
    for (const state of this.idleTipStates) {
      state.active = false;
      state.pulse = 0;
    }
    this.emit();
    this.lastFrameTime = performance.now();
    this.queueFrame();
    return this;
  }

  resetReaction() {
    this.reacting = false;
    this.reactionElapsed = 0;
    this.reactionProgress = 0;
    this.reactionAmount = 0;
    this.blinkAmount = 0;
    this.root.dataset.reacting = "false";
  }

  updateReaction(deltaTime) {
    if (!this.reacting) return;
    this.reactionElapsed += deltaTime;
    const progress = clamp01(
      this.reactionElapsed / Math.max(1, this.timing.reaction)
    );
    this.reactionProgress = progress;

    if (progress < 0.28) {
      this.reactionAmount = lerp(
        0,
        0.12,
        smoothOut(progress / 0.28)
      );
    } else if (progress < 0.68) {
      this.reactionAmount = lerp(
        0.12,
        -0.06,
        smootherstep((progress - 0.28) / 0.4)
      );
    } else {
      this.reactionAmount = lerp(
        -0.06,
        0,
        smoothOut((progress - 0.68) / 0.32)
      );
    }

    if (progress < 0.08 || progress >= 0.4) {
      this.blinkAmount = 0;
    } else if (progress < 0.23) {
      this.blinkAmount = smoothOut((progress - 0.08) / 0.15);
    } else {
      this.blinkAmount = 1 - smoothOut((progress - 0.23) / 0.17);
    }

    if (progress < 1) return;
    this.resetReaction();
    this.resetIdleTips();
    if (this.state === STATES.IDLE) {
      this.resetIdleVariant();
      this.scheduleAmbientPulse();
    }
    this.scheduleRandomBlink();
    this.emit();
  }

  cancelAmbientPulse() {
    this.ambientPulseActive = false;
    this.ambientPulseElapsed = 0;
    this.ambientPulseDelay = 0;
    this.ambientPulseAmount = 0;
    this.root.dataset.ambientPulsing = "false";
  }

  scheduleAmbientPulse(delay) {
    this.cancelAmbientPulse();
    this.ambientPulseDelay = this.idleMotion.pulseStrength > 0
      ? delay ?? randomBetween(
          this.idleMotion.pulseMinimumDelay,
          this.idleMotion.pulseMaximumDelay
        )
      : Number.POSITIVE_INFINITY;
  }

  startAmbientPulse() {
    if (
      this.state !== STATES.IDLE ||
      this.reacting ||
      this.reducedMotion.matches ||
      this.idleMotion.pulseStrength <= 0
    ) {
      return;
    }

    this.ambientPulseActive = true;
    this.ambientPulseElapsed = 0;
    this.ambientPulseAmount = 0;
    this.root.dataset.ambientPulsing = "true";
    this.emit();
  }

  updateAmbientPulse(deltaTime) {
    if (
      this.state !== STATES.IDLE ||
      this.reacting ||
      this.reducedMotion.matches
    ) {
      return;
    }

    if (!this.ambientPulseActive) {
      this.ambientPulseDelay -= deltaTime;
      if (this.ambientPulseDelay <= 0) this.startAmbientPulse();
      return;
    }

    this.ambientPulseElapsed += deltaTime;
    const progress = clamp01(
      this.ambientPulseElapsed / this.idleMotion.pulseDuration
    );
    const strength = this.idleMotion.pulseStrength;

    if (progress < 0.28) {
      this.ambientPulseAmount = lerp(
        0,
        0.115 * strength,
        smoothOut(progress / 0.28)
      );
    } else if (progress < 0.68) {
      this.ambientPulseAmount = lerp(
        0.115 * strength,
        -0.055 * strength,
        smootherstep((progress - 0.28) / 0.4)
      );
    } else {
      this.ambientPulseAmount = lerp(
        -0.055 * strength,
        0,
        smoothOut((progress - 0.68) / 0.32)
      );
    }

    if (progress < 1) return;
    this.scheduleAmbientPulse();
    this.emit();
  }

  scheduleRandomBlink(delay) {
    this.randomBlinkActive = false;
    this.randomBlinkElapsed = 0;
    this.randomBlinkAmount = 0;
    this.pendingRandomBlinks = 0;
    this.randomBlinkDelay = delay ?? randomBetween(
      this.idleMotion.blinkMinimumDelay,
      this.idleMotion.blinkMaximumDelay
    );
    this.root.dataset.blinking = "false";
  }

  startRandomBlink(isRepeat = false) {
    this.randomBlinkActive = true;
    this.randomBlinkElapsed = 0;
    this.randomBlinkAmount = 0;
    this.randomBlinkDuration = randomBetween(
      this.idleMotion.blinkMinimumDuration,
      this.idleMotion.blinkMaximumDuration
    );
    if (!isRepeat) {
      this.pendingRandomBlinks =
        Math.random() < this.idleMotion.doubleBlinkChance ? 1 : 0;
    }
    this.root.dataset.blinking = "true";
    this.emit();
  }

  updateRandomBlink(deltaTime) {
    if (
      this.reacting ||
      this.state !== STATES.IDLE ||
      this.reducedMotion.matches
    ) {
      return;
    }

    if (!this.randomBlinkActive) {
      this.randomBlinkDelay -= deltaTime;
      if (this.randomBlinkDelay > 0) return;
      const isRepeat = this.pendingRandomBlinks > 0;
      if (isRepeat) this.pendingRandomBlinks -= 1;
      this.startRandomBlink(isRepeat);
      return;
    }

    this.randomBlinkElapsed += deltaTime;
    const progress = clamp01(
      this.randomBlinkElapsed / this.randomBlinkDuration
    );
    this.randomBlinkAmount = progress < 0.4
      ? smoothOut(progress / 0.4)
      : 1 - smoothOut((progress - 0.4) / 0.6);

    if (progress < 1) return;
    this.randomBlinkActive = false;
    this.randomBlinkElapsed = 0;
    this.randomBlinkAmount = 0;
    this.root.dataset.blinking = "false";
    this.randomBlinkDelay = this.pendingRandomBlinks > 0
      ? randomBetween(85, 145)
      : randomBetween(
          this.idleMotion.blinkMinimumDelay,
          this.idleMotion.blinkMaximumDelay
        );
    this.emit();
  }

  pause() {
    if (this.state === STATES.PAUSED) return this;
    this.pausedState = this.state;
    this.changeState(STATES.PAUSED);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    return this;
  }

  resume() {
    if (this.state !== STATES.PAUSED) return this;
    const nextState = this.debugState ?? (
      this.turning
        ? STATES.MOVING
        : this.hasTarget
          ? this.morph < 0.82 ? STATES.LAUNCHING : STATES.MOVING
          : this.morph > 0.001 || this.speed > 0.5
            ? STATES.SETTLING
            : STATES.IDLE
    );
    this.changeState(nextState);
    this.lastFrameTime = performance.now();
    this.queueFrame();
    return this;
  }

  startTurn(nextFacing) {
    this.turnFromFacing = this.facing;
    this.pendingFacing = nextFacing;
    this.turnElapsed = 0;
    this.turnProgress = 0;
    this.turning = true;
    this.emit();
  }

  reverseTurn() {
    const previousFrom = this.turnFromFacing;
    this.turnFromFacing = this.pendingFacing;
    this.pendingFacing = previousFrom;
    this.turnProgress = 1 - this.turnProgress;
    this.turnElapsed = this.turnProgress * this.timing.turn;
  }

  updateTurn(deltaTime) {
    if (!this.turning) return;
    this.turnElapsed += deltaTime;
    this.turnProgress = clamp01(this.turnElapsed / this.timing.turn);

    if (this.turnProgress < 1) return;
    this.facing = this.pendingFacing;
    this.turnFromFacing = this.facing;
    this.pendingFacing = 0;
    this.turnElapsed = 0;
    this.turnProgress = 0;
    this.turning = false;
    this.visualTilt = 0;
    this.emit();
  }

  cancelIdleVariant() {
    this.idleVariant = "rest";
    this.idleVariantPhase = "waiting";
    this.idleVariantElapsed = 0;
    this.idleVariantMotionElapsed = 0;
    this.idleVariantAmount = 0;
    this.idleVariantDelay = 0;
    this.resetCuriousGaze();
    this.root.dataset.idleVariant = "rest";
  }

  resetCuriousGaze() {
    this.curiousGaze = 0;
    this.curiousGazeFrom = 0;
    this.curiousGazeTarget = 0;
    this.curiousGazeElapsed = 0;
    this.curiousGazeDuration = 500;
    this.curiousGazeDelay = 0;
    this.curiousGazeMoving = false;
    this.root.dataset.curiousGaze = "center";
  }

  startCuriousGaze(nextDirection) {
    const currentDirection = Math.abs(this.curiousGaze) > 0.2
      ? Math.sign(this.curiousGaze)
      : this.idleVariantDirection;
    this.curiousGazeFrom = this.curiousGaze;
    this.curiousGazeTarget = nextDirection ?? -currentDirection;
    this.curiousGazeElapsed = 0;
    this.curiousGazeDuration = randomBetween(420, 580);
    this.curiousGazeMoving = true;
  }

  updateCuriousGaze(deltaTime) {
    if (this.idleVariant !== "curious") return;

    if (!this.curiousGazeMoving) {
      this.curiousGazeDelay -= deltaTime;
      if (this.curiousGazeDelay <= 0) this.startCuriousGaze();
      return;
    }

    this.curiousGazeElapsed += deltaTime;
    const progress = clamp01(
      this.curiousGazeElapsed / Math.max(1, this.curiousGazeDuration)
    );
    this.curiousGaze = lerp(
      this.curiousGazeFrom,
      this.curiousGazeTarget,
      smoothOut(progress)
    );
    this.root.dataset.curiousGaze = this.curiousGaze < -0.2
      ? "left"
      : this.curiousGaze > 0.2
        ? "right"
        : "center";

    if (progress < 1) return;
    this.curiousGaze = this.curiousGazeTarget;
    this.curiousGazeMoving = false;
    this.curiousGazeDelay = randomBetween(380, 760);
  }

  configureIdleVariant(variant) {
    const profile = IDLE_VARIANT_PROFILES[variant];
    const timingVariance = randomBetween(0.92, 1.08);
    this.idleVariantAttackDuration = profile.attack * timingVariance;
    this.idleVariantHoldDuration = randomBetween(
      profile.holdMinimum,
      profile.holdMaximum
    );
    this.idleVariantReleaseDuration =
      profile.release * randomBetween(0.92, 1.08);
    this.idleVariantDirection = Math.random() < 0.5 ? -1 : 1;
  }

  resetIdleVariant() {
    this.cancelIdleVariant();

    if (
      this.reducedMotion.matches ||
      this.idleVariantMode === "rest"
    ) {
      return;
    }

    if (this.idleVariantMode === "auto") {
      this.idleVariantDelay = randomBetween(
        this.idleMotion.variantMinimumDelay,
        this.idleMotion.variantMaximumDelay
      );
      return;
    }

    this.idleVariant = this.idleVariantMode;
    this.idleVariantPhase = "attack";
    this.configureIdleVariant(this.idleVariant);
    if (this.idleVariant === "curious") {
      this.startCuriousGaze(this.idleVariantDirection);
    }
    this.root.dataset.idleVariant = this.idleVariant;
  }

  startIdleVariant() {
    const candidates = IDLE_VARIANTS.filter(
      (variant) => variant !== this.previousIdleVariant
    );
    const nextVariant = candidates[
      Math.floor(Math.random() * candidates.length)
    ];

    this.idleVariant = nextVariant;
    this.previousIdleVariant = nextVariant;
    this.idleVariantPhase = "attack";
    this.idleVariantElapsed = 0;
    this.idleVariantMotionElapsed = 0;
    this.idleVariantAmount = 0;
    this.configureIdleVariant(nextVariant);
    if (nextVariant === "curious") {
      this.startCuriousGaze(this.idleVariantDirection);
    }
    this.root.dataset.idleVariant = nextVariant;
    this.emit();
  }

  updateIdleVariant(deltaTime) {
    if (
      this.state !== STATES.IDLE ||
      this.reacting ||
      this.reducedMotion.matches ||
      this.idleVariantMode === "rest"
    ) {
      return;
    }

    if (this.idleVariantPhase === "waiting") {
      this.idleVariantDelay -= deltaTime;
      if (this.idleVariantDelay <= 0 && this.idleVariantMode === "auto") {
        this.startIdleVariant();
      }
      return;
    }

    this.updateCuriousGaze(deltaTime);
    this.idleVariantElapsed += deltaTime;
    this.idleVariantMotionElapsed += deltaTime;

    if (this.idleVariantPhase === "attack") {
      const progress = clamp01(
        this.idleVariantElapsed /
          Math.max(1, this.idleVariantAttackDuration)
      );
      this.idleVariantAmount = smoothOut(progress);
      if (progress < 1) return;

      this.idleVariantAmount = 1;
      this.idleVariantElapsed = 0;
      this.idleVariantPhase = this.idleVariantMode === "auto"
        ? "hold"
        : "locked";
      this.emit();
      return;
    }

    if (this.idleVariantPhase === "locked") {
      this.idleVariantAmount = 1;
      return;
    }

    if (this.idleVariantPhase === "hold") {
      this.idleVariantAmount = 1;
      if (this.idleVariantElapsed < this.idleVariantHoldDuration) return;
      this.idleVariantElapsed = 0;
      this.idleVariantPhase = "release";
      return;
    }

    const progress = clamp01(
      this.idleVariantElapsed /
        Math.max(1, this.idleVariantReleaseDuration)
    );
    this.idleVariantAmount = 1 - smoothOut(progress);
    if (progress < 1) return;

    this.cancelIdleVariant();
    this.idleVariantDelay = randomBetween(
      this.idleMotion.variantMinimumDelay,
      this.idleMotion.variantMaximumDelay
    );
    this.emit();
  }

  resetIdleTips() {
    const randomizedOrder = shuffle(
      this.idleTipStates.map((state, index) => index)
    );
    const delays = new Array(this.idleTipStates.length);

    randomizedOrder.forEach((tipIndex, orderIndex) => {
      delays[tipIndex] =
        this.timing.idleCycle * 0.04 +
        orderIndex * this.timing.idleCycle * 0.07 +
        randomBetween(0, this.timing.idleCycle * 0.12);
    });

    this.idleTipStates.forEach((state, index) => {
      state.active = false;
      state.delay = delays[index];
      state.elapsed = 0;
      state.attackDuration = randomBetween(
        this.timing.idleCycle * 0.14,
        this.timing.idleCycle * 0.62
      ) / this.idleMotion.tipSpeed;
      state.releaseDuration = randomBetween(
        this.timing.idleCycle * 0.18,
        this.timing.idleCycle * 0.85
      ) / this.idleMotion.tipSpeed;
      state.attackCurve = randomBetween(0.78, 1.55);
      state.releaseCurve = randomBetween(0.78, 1.7);
      state.depth = randomBetween(0.72, 1);
      state.spread = randomBetween(0.65, 1.45);
      state.detail = randomBetween(0.05, 1);
      state.pulse = 0;
    });
  }

  startIdleTipPulse(state) {
    state.active = true;
    state.elapsed = 0;
    state.attackDuration = randomBetween(
      this.timing.idleCycle * 0.14,
      this.timing.idleCycle * 0.62
    ) / this.idleMotion.tipSpeed;
    state.releaseDuration = randomBetween(
      this.timing.idleCycle * 0.18,
      this.timing.idleCycle * 0.85
    ) / this.idleMotion.tipSpeed;
    state.attackCurve = randomBetween(0.78, 1.55);
    state.releaseCurve = randomBetween(0.78, 1.7);
    state.depth = randomBetween(0.55, 1);
    state.spread = randomBetween(0.65, 1.45);
    state.detail = randomBetween(0.05, 1);
    state.pulse = 0;
  }

  updateIdleTips(deltaTime) {
    let activeCount = this.idleTipStates.reduce(
      (count, state) => count + Number(state.active),
      0
    );

    for (const state of this.idleTipStates) {
      if (!state.active) continue;
      state.elapsed += deltaTime;
      const totalDuration = state.attackDuration + state.releaseDuration;

      if (state.elapsed < state.attackDuration) {
        const attackProgress = smoothstep(
          state.elapsed / state.attackDuration
        );
        state.pulse = Math.pow(attackProgress, state.attackCurve);
      } else {
        const releaseProgress = smoothstep(
          (state.elapsed - state.attackDuration) / state.releaseDuration
        );
        state.pulse = 1 - Math.pow(
          releaseProgress,
          state.releaseCurve
        );
      }

      if (state.elapsed >= totalDuration) {
        state.active = false;
        state.pulse = 0;
        state.delay = randomBetween(
          this.timing.idleCycle * 0.12,
          this.timing.idleCycle * 1.25
        );
        activeCount -= 1;
      }
    }

    for (const state of this.idleTipStates) {
      if (state.active) continue;
      state.delay -= deltaTime;
      if (state.delay > 0) continue;

      if (activeCount >= this.idleTipModel.maximumConcurrent) {
        state.delay = randomBetween(
          this.timing.idleCycle * 0.055,
          this.timing.idleCycle * 0.145
        );
        continue;
      }

      this.startIdleTipPulse(state);
      activeCount += 1;
    }
  }

  updateTailMotion(deltaTime) {
    const deltaSeconds = deltaTime / 1000;
    const speedProgress = smoothstep(
      this.speed / this.physics.maximumSpeed
    );
    const targetRate = lerp(
      this.tailMotion.minimumRate,
      this.tailMotion.maximumRate,
      speedProgress
    );
    const rateBlend = 1 - Math.exp(
      -this.tailMotion.response * deltaSeconds
    );
    this.tailRate += (targetRate - this.tailRate) * rateBlend;
    this.tailPhase = (
      this.tailPhase + this.tailRate * deltaSeconds
    ) % (Math.PI * 2048);
  }

  update(deltaTime) {
    const deltaSeconds = deltaTime / 1000;
    this.updateReaction(deltaTime);
    this.updateRandomBlink(deltaTime);
    this.updateAmbientPulse(deltaTime);

    if (this.debugState !== null) {
      this.updateTailMotion(deltaTime);
      const targetMorph = DEBUG_MORPH_TARGETS[this.debugState];
      const morphDuration = targetMorph > this.morph
        ? this.timing.morphIn
        : this.timing.morphOut;
      const morphBlend = 1 - Math.exp(
        -deltaTime / Math.max(1, morphDuration * 0.32)
      );
      this.morph += (targetMorph - this.morph) * morphBlend;
      if (this.morph < 0.0005) this.morph = 0;
      if (this.morph > 0.9995) this.morph = 1;
      if (this.debugState === STATES.IDLE) {
        this.idleElapsed += deltaTime;
        if (!this.reacting) {
          this.updateIdleTips(deltaTime);
          this.updateIdleVariant(deltaTime);
        }
      } else {
        this.idleElapsed = 0;
      }
      return;
    }

    let accelerationX = 0;
    let accelerationY = 0;

    if (this.hasTarget) {
      const offsetX = this.target.x - this.position.x;
      const offsetY = this.target.y - this.position.y;
      accelerationX =
        offsetX * this.physics.stiffness -
        this.velocity.x * this.physics.damping;
      accelerationY =
        offsetY * this.physics.stiffness -
        this.velocity.y * this.physics.damping;
      const limitedAcceleration = limitVector(
        accelerationX,
        accelerationY,
        this.physics.maximumAcceleration
      );
      accelerationX = limitedAcceleration.x;
      accelerationY = limitedAcceleration.y;
    } else {
      const drag = Math.exp(-this.physics.idleDrag * deltaSeconds);
      this.velocity.x *= drag;
      this.velocity.y *= drag;
    }

    this.velocity.x += accelerationX * deltaSeconds;
    this.velocity.y += accelerationY * deltaSeconds;
    const limitedVelocity = limitVector(
      this.velocity.x,
      this.velocity.y,
      this.physics.maximumSpeed
    );
    this.velocity.x = limitedVelocity.x;
    this.velocity.y = limitedVelocity.y;

    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;
    this.position.x = clamp(
      this.position.x,
      this.bounds.minimumX,
      this.bounds.maximumX
    );
    this.position.y = clamp(
      this.position.y,
      this.bounds.minimumY,
      this.bounds.maximumY
    );

    this.speed = Math.hypot(this.velocity.x, this.velocity.y);
    this.updateTailMotion(deltaTime);
    const distance = Math.hypot(
      this.target.x - this.position.x,
      this.target.y - this.position.y
    );

    if (
      this.hasTarget &&
      distance < this.physics.arrivalRadius &&
      this.speed < this.physics.stopSpeed
    ) {
      this.hasTarget = false;
      this.target.x = this.position.x;
      this.target.y = this.position.y;
    }

    const horizontalIntent = this.hasTarget
      ? this.target.x - this.position.x
      : this.velocity.x;
    if (Math.abs(horizontalIntent) > 10) {
      const desiredFacing = horizontalIntent >= 0 ? 1 : -1;
      if (this.turning) {
        if (desiredFacing !== this.pendingFacing) this.reverseTurn();
      } else if (desiredFacing !== this.facing) {
        if (this.morph <= 0.3) {
          this.facing = desiredFacing;
          this.turnFromFacing = desiredFacing;
          this.pendingFacing = 0;
          this.visualTilt = 0;
        } else {
          this.startTurn(desiredFacing);
        }
      }
    }
    this.updateTurn(deltaTime);

    if (this.speed > 3) {
      const desiredHeading = Math.atan2(this.velocity.y, this.velocity.x);
      this.heading += shortestAngle(this.heading, desiredHeading) * (
        1 - Math.exp(-this.physics.headingResponse * deltaSeconds)
      );

      const desiredTilt = this.turning
        ? 0
        : clamp(
            Math.atan2(this.velocity.y, Math.max(1, Math.abs(this.velocity.x))) *
              this.facing,
            -Math.PI * 0.44,
            Math.PI * 0.44
          );
      this.visualTilt += shortestAngle(this.visualTilt, desiredTilt) * (
        1 - Math.exp(-this.physics.headingResponse * deltaSeconds)
      );
    }

    const speedProgress = smoothstep(
      (this.speed - 18) / (this.physics.maximumSpeed * 0.22 - 18)
    );
    const targetMorph = this.turning
      ? Math.max(0.9, speedProgress)
      : speedProgress;
    const morphDuration = targetMorph > this.morph
      ? this.timing.morphIn
      : this.timing.morphOut;
    const morphBlend = 1 - Math.exp(-deltaTime / Math.max(1, morphDuration * 0.32));
    this.morph += (targetMorph - this.morph) * morphBlend;
    if (this.morph < 0.0005) this.morph = 0;
    if (this.morph > 0.9995) this.morph = 1;

    let nextState;
    if (this.turning) {
      nextState = STATES.MOVING;
    } else if (this.hasTarget) {
      nextState = this.state === STATES.MOVING || this.morph >= 0.82
        ? STATES.MOVING
        : STATES.LAUNCHING;
    } else if (this.speed > 0.5 || this.morph > 0.001) {
      nextState = STATES.SETTLING;
    } else {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.speed = 0;
      nextState = STATES.IDLE;
    }
    if (this.state !== nextState) this.changeState(nextState);

    if (nextState === STATES.IDLE) {
      this.idleElapsed += deltaTime;
      if (!this.reacting) {
        this.updateIdleTips(deltaTime);
        this.updateIdleVariant(deltaTime);
      }
    }
  }

  render() {
    const bodyBuffer = this.geometry.bodyBuffer;
    const starBody = this.geometry.star.body;
    const motionGeometry = this.facing === 1
      ? this.geometry.motion.right
      : this.geometry.motion.left;
    let turnGeometryFrom = motionGeometry;
    let turnGeometryTo = motionGeometry;
    let turnMix = 0;

    if (this.turning) {
      const sourceGeometry = this.turnFromFacing === 1
        ? this.geometry.motion.right
        : this.geometry.motion.left;
      const targetGeometry = this.pendingFacing === 1
        ? this.geometry.motion.right
        : this.geometry.motion.left;
      if (this.turnProgress < 0.5) {
        turnGeometryFrom = sourceGeometry;
        turnGeometryTo = this.geometry.turnBridge;
        turnMix = smootherstep(this.turnProgress * 2);
      } else {
        turnGeometryFrom = this.geometry.turnBridge;
        turnGeometryTo = targetGeometry;
        turnMix = smootherstep((this.turnProgress - 0.5) * 2);
      }
    }

    const tailModel = this.facing === 1
      ? this.tailModels.right
      : this.tailModels.left;
    const morphFacing = this.turning
      ? this.turnProgress < 0.5
        ? this.turnFromFacing
        : this.pendingFacing
      : this.facing;
    const morphEnvelope = Math.sin(Math.PI * this.morph);
    const eyeMorph = smootherstep(clamp01(
      this.morph - morphEnvelope * this.morphModel.eyeDelay
    ));
    const idleIsActive = this.state === STATES.IDLE;
    const idleEnvelope = idleIsActive
      ? smoothOut(this.idleElapsed / this.timing.idleReveal)
      : 0;
    const breathPosition =
      (this.idleElapsed % this.timing.breathCycle) /
      this.timing.breathCycle;
    const breathProgress = breathPosition < 0.42
      ? smoothstep(breathPosition / 0.42)
      : 1 - smoothstep((breathPosition - 0.42) / 0.58);
    const idleVariantAmount =
      idleEnvelope *
      this.idleVariantAmount *
      this.idleMotion.variantStrength;
    const idleVariantTime = this.idleVariantMotionElapsed / 1000;
    let variantOffsetX = 0;
    let variantOffsetY = 0;
    let variantRotation = 0;
    let variantScaleX = 1;
    let variantScaleY = 1;
    let variantEyeOffsetX = 0;
    let variantEyeOffsetY = 0;
    let breathDepth = 1;

    if (this.idleVariant === "curious") {
      const curiousDrift = 0.88 + Math.sin(idleVariantTime * 2.1) * 0.12;
      const curiousAmount = idleVariantAmount * curiousDrift;
      variantOffsetX = this.idleVariantDirection * curiousAmount * 1.8;
      variantOffsetY = -curiousAmount * 0.8;
      variantRotation = this.idleVariantDirection * curiousAmount * 4.5;
      variantScaleX = 1 + curiousAmount * 0.012;
      variantScaleY = 1 - curiousAmount * 0.008;
      variantEyeOffsetX =
        this.curiousGaze * idleVariantAmount * 2.9;
      variantEyeOffsetY = -curiousAmount * 0.45;
    } else if (this.idleVariant === "squish") {
      const squishPulse = 0.82 + Math.sin(idleVariantTime * 4.6) * 0.18;
      const squishAmount = idleVariantAmount * squishPulse;
      variantOffsetY = squishAmount * 1.4;
      variantScaleX = 1 + squishAmount * 0.062;
      variantScaleY = 1 - squishAmount * 0.055;
      variantEyeOffsetY = squishAmount * 0.65;
    } else if (this.idleVariant === "float") {
      const floatWave = Math.sin(idleVariantTime * 2.25);
      variantOffsetY = idleVariantAmount * (-2.2 + floatWave * 1.25);
      variantOffsetX =
        this.idleVariantDirection * idleVariantAmount * floatWave * 0.55;
      variantRotation =
        this.idleVariantDirection * idleVariantAmount * (1.4 + floatWave * 0.7);
      variantScaleX = 1 - idleVariantAmount * 0.008;
      variantScaleY = 1 + idleVariantAmount * 0.014;
    } else if (this.idleVariant === "deep-breath") {
      breathDepth += idleVariantAmount * 1.15;
      variantOffsetY = -idleVariantAmount * breathProgress * 1.15;
      variantScaleX = 1 + idleVariantAmount * breathProgress * 0.008;
    }

    const breathAmount =
      idleEnvelope *
      breathProgress *
      this.idleMotion.breathAmplitude *
      breathDepth;
    const breathScaleX = 1 + breathAmount * 0.72;
    const breathScaleY = 1 + breathAmount;
    const speedScale = this.speed / this.physics.maximumSpeed;
    const tailActivity = this.reducedMotion.matches
      ? 0
      : this.debugState === STATES.MOVING
        ? this.morph
        : this.morph * (0.35 + clamp01(speedScale * 1.8) * 0.65);

    for (let index = 0; index < bodyBuffer.length; index += 1) {
      const starPoint = starBody[index];
      const motionPointFrom = turnGeometryFrom.body[index];
      const motionPointTo = turnGeometryTo.body[index];
      let motionX = lerp(motionPointFrom.x, motionPointTo.x, turnMix);
      let motionY = lerp(motionPointFrom.y, motionPointTo.y, turnMix);

      if (!this.turning && this.morph > 0) {
        for (const tail of tailModel.tails) {
          const tailFactor = tail.influence[index];
          if (tailFactor === 0) continue;
          const tailContraction = (
            1 - Math.cos(this.tailPhase + tail.phase)
          ) / 2;
          const pull =
            tailContraction *
            tailModel.retractionMaximum *
            tailFactor *
            tailActivity;
          motionX = lerp(motionX, tail.anchor.x, pull);
          motionY = lerp(motionY, tail.anchor.y, pull);
        }
      }

      const directionalPosition = clamp(
        starPoint.x * morphFacing / this.morphModel.halfWidth,
        -1,
        1
      );
      const localMorph = smootherstep(clamp01(
        this.morph +
        morphEnvelope * directionalPosition * this.morphModel.bodyWave
      ));
      let x = lerp(starPoint.x, motionX, localMorph);
      let y = lerp(starPoint.y, motionY, localMorph);

      if (idleEnvelope > 0) {
        let localPulse = 0;
        let localDetail = 0;

        for (
          let tipIndex = 0;
          tipIndex < this.idleTipModel.tips.length;
          tipIndex += 1
        ) {
          const state = this.idleTipStates[tipIndex];
          if (state.pulse === 0) continue;
          const influence = this.idleTipModel.tips[tipIndex].influence[index];
          if (influence === 0) continue;
          const candidate =
            state.pulse *
            state.depth *
            Math.pow(influence, state.spread);
          if (candidate > localPulse) {
            localPulse = candidate;
            localDetail = state.detail;
          }
        }

        const radialOffset = -idleEnvelope * localPulse * (
          this.idleMotion.baseAmplitude +
          this.idleMotion.tipAmplitude +
          localDetail * this.idleMotion.rippleAmplitude
        );
        x *= 1 + radialOffset;
        y *= 1 + radialOffset;
      }

      const combinedPulseAmount =
        this.reactionAmount + this.ambientPulseAmount;
      if (combinedPulseAmount !== 0) {
        let reactionInfluence = 0;
        for (const tip of this.idleTipModel.tips) {
          reactionInfluence = Math.max(
            reactionInfluence,
            tip.influence[index]
          );
        }
        const reactionScale =
          1 + combinedPulseAmount * reactionInfluence;
        x *= reactionScale;
        y *= reactionScale;
      }

      bodyBuffer[index].x = x;
      bodyBuffer[index].y = y;
    }
    this.body.setAttribute("d", smoothClosedPath(bodyBuffer));

    const combinedBlinkAmount = Math.max(
      this.blinkAmount,
      this.randomBlinkAmount
    );
    for (let eyeIndex = 0; eyeIndex < this.eyes.length; eyeIndex += 1) {
      const buffer = this.geometry.eyeBuffers[eyeIndex];
      const starEye = this.geometry.star.eyes[eyeIndex];
      const motionEyeFrom = turnGeometryFrom.eyes[eyeIndex];
      const motionEyeTo = turnGeometryTo.eyes[eyeIndex];

      for (let pointIndex = 0; pointIndex < buffer.length; pointIndex += 1) {
        const motionEyeX = lerp(
          motionEyeFrom[pointIndex].x,
          motionEyeTo[pointIndex].x,
          turnMix
        );
        const motionEyeY = lerp(
          motionEyeFrom[pointIndex].y,
          motionEyeTo[pointIndex].y,
          turnMix
        );
        buffer[pointIndex].x = lerp(
          starEye[pointIndex].x,
          motionEyeX,
          eyeMorph
        );
        buffer[pointIndex].y = lerp(
          starEye[pointIndex].y,
          motionEyeY,
          eyeMorph
        ) + variantEyeOffsetY;
        buffer[pointIndex].x += variantEyeOffsetX;
      }

      if (combinedBlinkAmount > 0) {
        const eyeBounds = getPointBounds(buffer);
        const blinkScaleY = lerp(1, 0.06, combinedBlinkAmount);
        for (const point of buffer) {
          point.y = eyeBounds.centerY +
            (point.y - eyeBounds.centerY) * blinkScaleY;
        }
      }
      this.eyes[eyeIndex].setAttribute("d", smoothClosedPath(buffer));
    }

    const rotation =
      (this.visualTilt * 180 / Math.PI) * smootherstep(this.morph) +
      variantRotation;
    const scaleX =
      breathScaleX * variantScaleX * (1 + speedScale * 0.025);
    const scaleY =
      breathScaleY * variantScaleY * (1 - speedScale * 0.012);
    const renderPositionX = this.position.x + variantOffsetX;
    const renderPositionY = this.position.y + variantOffsetY;
    this.root.setAttribute(
      "transform",
      "translate(" +
        formatNumber(renderPositionX) +
        " " +
        formatNumber(renderPositionY) +
        ") rotate(" +
        formatNumber(rotation) +
        ") scale(" +
        formatNumber(scaleX, 4) +
        " " +
        formatNumber(scaleY, 4) +
        ")"
    );

    this.updateSpeechBubble(renderPositionX, renderPositionY);

    if (this.trailSource) {
      const firstTail = tailModel.tails[0];
      const secondTail = tailModel.tails[1];
      const firstTip = bodyBuffer[firstTail.tipIndex];
      const secondTip = bodyBuffer[secondTail.tipIndex];
      const tipMidpointX = (firstTip.x + secondTip.x) / 2;
      const tipMidpointY = (firstTip.y + secondTip.y) / 2;
      const localTailX = tipMidpointX * (1 - DITHER_TRAIL_TIP_INSET);
      const localTailY = tipMidpointY * (1 - DITHER_TRAIL_TIP_INSET);
      const rotationRadians = rotation * Math.PI / 180;
      const cosine = Math.cos(rotationRadians);
      const sine = Math.sin(rotationRadians);
      const scaledTailX = localTailX * scaleX;
      const scaledTailY = localTailY * scaleY;
      const worldTailX = renderPositionX +
        scaledTailX * cosine - scaledTailY * sine;
      const worldTailY = renderPositionY +
        scaledTailX * sine + scaledTailY * cosine;

      this.trailSource.x = clamp01(worldTailX / 1200);
      this.trailSource.y = 1 - clamp01(worldTailY / 600);
      this.trailSource.active =
        !this.turning &&
        this.morph > 0.12 &&
        this.speed > 2 &&
        this.state !== STATES.PAUSED;
    }
  }

  updateSpeechBubble(renderPositionX, renderPositionY) {
    if (!this.speechBubble) return;

    const bubble = this.speechBubble;
    const safePadding = 14;
    const verticalRadius = this.targetHeight * 0.58;
    const horizontalRadius = this.targetHeight * 0.72;
    const available = {
      top: renderPositionY - verticalRadius - bubble.offset - safePadding,
      right:
        1200 - renderPositionX - horizontalRadius - bubble.offset - safePadding,
      bottom:
        600 - renderPositionY - verticalRadius - bubble.offset - safePadding,
      left: renderPositionX - horizontalRadius - bubble.offset - safePadding
    };
    const required = {
      top: bubble.height,
      right: bubble.width,
      bottom: bubble.height,
      left: bubble.width
    };

    let placement = bubble.placement;
    if (placement === "auto") {
      const preferred = ["top", "right", "left", "bottom"];
      placement = preferred.find(
        (candidate) => available[candidate] >= required[candidate]
      ) ?? preferred.reduce((best, candidate) =>
        available[candidate] - required[candidate] >
        available[best] - required[best]
          ? candidate
          : best
      );
    }

    let x = renderPositionX - bubble.width / 2;
    let y = renderPositionY - verticalRadius - bubble.offset - bubble.height;

    if (placement === "bottom") {
      y = renderPositionY + verticalRadius + bubble.offset;
    } else if (placement === "left") {
      x = renderPositionX - horizontalRadius - bubble.offset - bubble.width;
      y = renderPositionY - bubble.height / 2;
    } else if (placement === "right") {
      x = renderPositionX + horizontalRadius + bubble.offset;
      y = renderPositionY - bubble.height / 2;
    }

    x = clamp(x, safePadding, 1200 - bubble.width - safePadding);
    y = clamp(y, safePadding, 600 - bubble.height - safePadding);

    const tipX = clamp(renderPositionX - x, 22, bubble.width - 22);
    const tipY = clamp(renderPositionY - y, 22, bubble.height - 22);
    bubble.element.setAttribute("x", formatNumber(x));
    bubble.element.setAttribute("y", formatNumber(y));
    bubble.element.dataset.placement = placement;
    bubble.element.style.setProperty(
      "--seam-speech-tip-x",
      formatNumber(tipX) + "px"
    );
    bubble.element.style.setProperty(
      "--seam-speech-tip-y",
      formatNumber(tipY) + "px"
    );
  }

  changeState(nextState) {
    if (this.state === nextState) return;
    if (
      nextState !== STATES.IDLE &&
      nextState !== STATES.SETTLING &&
      this.reacting
    ) {
      this.resetReaction();
    }
    this.previousState = this.state;
    this.state = nextState;
    this.root.dataset.state = nextState;
    if (nextState === STATES.IDLE) {
      this.idleElapsed = 0;
      this.resetIdleTips();
      this.resetIdleVariant();
      if (!this.reacting) {
        this.scheduleRandomBlink();
        this.scheduleAmbientPulse();
      }
    } else {
      this.cancelIdleVariant();
      this.cancelAmbientPulse();
      this.scheduleRandomBlink();
    }
    this.emit();
  }

  emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
    this.root.dispatchEvent(
      new CustomEvent("mascotstatechange", { detail: snapshot })
    );
  }

  tick(now) {
    this.frame = 0;
    if (
      this.destroyed ||
      !this.started ||
      this.state === STATES.PAUSED ||
      document.hidden
    ) {
      return;
    }

    const deltaTime = clamp(now - this.lastFrameTime, 0, 50);
    this.lastFrameTime = now;
    this.update(deltaTime);
    this.render();
    this.queueFrame();
  }

  queueFrame() {
    if (
      this.frame ||
      this.destroyed ||
      !this.started ||
      this.state === STATES.PAUSED ||
      document.hidden ||
      this.reducedMotion.matches
    ) {
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  }

  handleVisibilityChange() {
    if (document.hidden) {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
      return;
    }
    this.lastFrameTime = performance.now();
    this.queueFrame();
  }
}

MascotStateMachine.STATES = STATES;
MascotStateMachine.EVENTS = EVENTS;

export { EVENTS, MascotStateMachine, STATES };
