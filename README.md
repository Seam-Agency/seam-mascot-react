<p align="center">
  <img
    src="https://raw.githubusercontent.com/Seam-Agency/seam-mascot-react/main/assets/icon/seam-mascot-icon.svg"
    width="128"
    height="128"
    alt="Seam mascot"
  />
</p>

# @seam-agency/mascot-react

A lightweight React component for Seam's procedural SVG mascot. It morphs from an organic idle star into a directional motion form.

Repository-ready SVG, 1024px, and 512px icon exports are available in
[`assets/icon`](https://github.com/Seam-Agency/seam-mascot-react/tree/main/assets/icon).

- Runs animation through a single `requestAnimationFrame` state machine without re-rendering React on every frame.
- Follows the pointer across both axes using velocity, acceleration, and spring physics.
- Includes velocity-reactive tail motion, a neutral direction-change bridge, and procedural idle breathing.
- Can render an opt-in WebGL dither trail directly from the moving form's two tail tips.
- Plays a coordinated spike pop and blink whenever its visible form is idle-ready.
- Blinks procedurally during idle with randomized timing and occasional double blinks.
- Rotates through distinct ambient idle moods without leaving the top-level `idle` state.
- Supports server-side rendering and respects `prefers-reduced-motion`.
- Ships with TypeScript declarations; React is a peer dependency and the HTML bubble uses `@lisse/react` for its smooth action surface.

## Installation

Install the latest public release directly from GitHub without a token:

```bash
npm install https://github.com/Seam-Agency/seam-mascot-react/releases/latest/download/seam-mascot-react.tgz
```

The tarball still installs under its package name, so imports remain unchanged:

```tsx
import { SeamMascot } from "@seam-agency/mascot-react";
```

### GitHub Packages

The package is also published to GitHub Packages. GitHub requires authentication for npm registry downloads even when the repository and package are public. To use that registry, configure your project's `.npmrc`:

```ini
@seam-agency:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then install the package:

```bash
npm install @seam-agency/mascot-react
```

The token needs the `read:packages` permission. Keep it out of source control and provide it through the `NODE_AUTH_TOKEN` environment variable.

## Basic usage

```tsx
import { SeamMascot } from "@seam-agency/mascot-react";

export function HeroMascot() {
  return (
    <SeamMascot
      interactive
      style={{ width: "100%", height: "100%", background: "#050505" }}
      onStateChange={(snapshot) => {
        console.log(snapshot.state, snapshot.speed);
      }}
    />
  );
}
```

The default SVG `viewBox` is `0 0 1200 600`. The mascot moves within this space; use CSS to control the component's rendered size.

## Dither trail

Enable the packaged tail effect with one boolean:

```tsx
<SeamMascot ditherTrail />
```

The effect is disabled by default. It emits from the midpoint of the two animated tail tips, follows facing and tilt, and resets cleanly during direction changes. Its color follows `bodyColor`.

Use `ditherTrailIntensity` to tune the normalized density from `0` to `1`. The default is the subtle `0` preset:

```tsx
<SeamMascot ditherTrail ditherTrailIntensity={0} />
```

`ditherTrailScale` controls the visible footprint independently. Values below `1` shorten and narrow the trail without changing its color:

```tsx
<SeamMascot ditherTrail ditherTrailScale={0.72} />
```

The implementation uses the browser's WebGL API directly, adds no runtime dependency, respects `prefers-reduced-motion`, and falls back to the regular mascot when WebGL is unavailable.

`bodyColor` and `eyeColor` control the SVG mascot. Use `bodyStrokeColor` and `bodyStrokeWidth` when the mascot needs a crisp outline across contrasting themes. `ditherTrailColor` controls the trail independently and falls back to `bodyColor` when omitted:

```tsx
const mascotTheme = colorScheme === "dark"
  ? {
      bodyColor: "#ffffff",
      eyeColor: "#050505",
      ditherTrailColor: "#ffffff"
    }
  : {
      bodyColor: "#ffffff",
      bodyStrokeColor: "#050505",
      bodyStrokeWidth: 1.5,
      eyeColor: "#050505",
      ditherTrailColor: "#050505"
    };

<SeamMascot ditherTrail {...mascotTheme} />
```

## Imperative API

```tsx
import { useRef } from "react";
import { SeamMascot, type SeamMascotHandle } from "@seam-agency/mascot-react";

export function ControlledMascot() {
  const mascot = useRef<SeamMascotHandle>(null);

  return (
    <>
      <SeamMascot ref={mascot} interactive={false} />
      <button onClick={() => mascot.current?.moveTo({ x: 0.8, y: 0.3 })}>
        Move
      </button>
      <button onClick={() => mascot.current?.stop()}>Return to idle</button>
    </>
  );
}
```

`moveTo` uses normalized `0..1` coordinates by default. To use SVG coordinates, pass `{ x: 800, y: 240, unit: "svg" }`.

The ref also exposes `start`, `pause`, `resume`, `playReaction`, `follow`, `setState`, `setDebugState`, `setIdleVariant`, `setTypingFocus`, `send`, `getSnapshot`, and `getMachine`.

## Speech bubble

For crisp interface text, render `SeamMascotBubble` beside the mascot. It is a regular HTML layer, anchors to the mascot's stable position instead of its breathing transform, rounds coordinates to device pixels, and automatically chooses a side with enough room. It intentionally has no speech-tail arrow:

```tsx
import { useRef } from "react";
import {
  SeamMascot,
  SeamMascotBubble,
  type SeamMascotHandle
} from "@seam-agency/mascot-react";

const mascotRef = useRef<SeamMascotHandle>(null);

<>
  <SeamMascot ref={mascotRef} />
  <SeamMascotBubble
    mascotRef={mascotRef}
    visible
    placement="auto"
    theme="dark"
    nudgeY={-36}
    action={{
      label: "Continue",
      icon: <ArrowRightIcon aria-hidden />,
      onClick: goToNextStep
    }}
  >
    Create from one clear idea.
  </SeamMascotBubble>
</>
```

Keep it mounted and toggle `visible` for the built-in origin-aware popover transition. The surface opens from the corner nearest the mascot in 250ms and retracts in 150ms without blurring the text. `placement`, `offset`, `mascotClearance`, `edgePadding`, `nudgeX`, and `nudgeY` control its layout; a negative `nudgeY` creates a compact upper-diagonal composition. Use `surfaceClassName` or `surfaceStyle` to customize the surface; interactive content is supported.

The optional `action` stays on the corner nearest the mascot and follows the bubble theme. `action.icon` accepts any React node, so Nucleo and other icon components can be passed directly. The label, accessible label, disabled state, click handler, class, and inline style are also replaceable.

### Typed message sequences

`SeamMascotTypewriter` reveals plain text with punctuation-aware timing while reserving the final text size from the first frame, so the bubble does not resize character by character. Use a regular array for multiple messages at one mascot location, then move the mascot only after the final message:

```tsx
import { useEffect, useState } from "react";
import {
  SeamMascotBubble,
  SeamMascotTypewriter
} from "@seam-agency/mascot-react";

const messages = [
  "Start with one clear idea.",
  "Bring your brand references with you.",
  "Refine the strongest direction."
];
const [messageIndex, setMessageIndex] = useState(0);
const [typingComplete, setTypingComplete] = useState(false);
const [revealAll, setRevealAll] = useState(false);

useEffect(() => {
  mascotRef.current?.setIdleVariant("typing");
}, [messageIndex]);

function continueDialogue() {
  if (!typingComplete) {
    setRevealAll(true);
    return;
  }
  if (messageIndex < messages.length - 1) {
    setMessageIndex(index => index + 1);
    setTypingComplete(false);
    setRevealAll(false);
    return;
  }
  moveToNextLocation();
}

<SeamMascotBubble
  mascotRef={mascotRef}
  action={{ label: "Continue", onClick: continueDialogue }}
>
  <SeamMascotTypewriter
    key={messageIndex}
    text={messages[messageIndex]}
    revealAll={revealAll}
    onComplete={() => {
      setTypingComplete(true);
      mascotRef.current?.setIdleVariant("auto");
    }}
  />
</SeamMascotBubble>
```

`speed`, `startDelay`, and `punctuationDelay` tune the cadence. Set `active={false}` while the mascot is travelling to pause without losing progress, pass `cursor={false}` to remove the cursor, or set `revealAll` to finish the current message immediately. Reduced-motion users receive the complete text without the typing animation.

The original SVG-contained `speechBubble` and `speechBubbleOptions` props remain available for self-contained SVG exports. Use `SeamMascotBubble` for product UI where native-resolution text matters.

### Full product tour

See [Building a product tour](docs/TOUR_DEMO.md) for the complete multi-location controller, DOM-to-SVG coordinate conversion, arrival guard, multi-message typing lifecycle, bubble-aware reading focus, responsive behavior, accessibility notes, and testing checklist.

## Click reaction

Clicking the mascot while its visible morph is close to the idle star pushes every spike slightly beyond its resting shape, pulls them inward, and releases them while the eyes blink once. Eligibility follows the visible morph rather than the nominal state, so a nearby pointer target cannot leave an idle-looking mascot unresponsive in `moving`. Starting the reaction cancels that residual target and velocity. It also works with `debugState="idle"`. The 400ms reaction uses the transitions.dev smooth-out curve between phases.

Disable the interaction or trigger it manually with the ref API:

```tsx
<SeamMascot reactionOnClick={false} />

<button onClick={() => mascot.current?.playReaction()}>React</button>
```

The reaction is skipped when `prefers-reduced-motion: reduce` is active.

Independent idle blinks use a randomized `1800–5200ms` delay and `110–180ms` duration by default. Approximately 18% of them become a short double blink. The scheduler also runs in fixed idle debug mode and pauses during click reactions.

## Ambient idle moods

The default `idleVariant="auto"` mode gives the stationary mascot seven occasional behaviors: curious, bored, shy, surprised, squish, float, and deep-breath. Curious alternates its gaze, bored scans slowly with half-lidded eyes, shy looks down and aside, and surprised briefly widens both eyes. Each behavior enters and leaves through a short smooth-out transition while the machine remains in `idle`, so application logic listening to the top-level state stays stable. The explicit `typing` variant holds its gaze toward the writing surface and moves both eyes through a subtle vertical reading scan; it is intentionally excluded from the random `auto` rotation.

Lock a mood while tuning or presenting it:

```tsx
<SeamMascot idleVariant="curious" />
```

Supported values are `auto`, `rest`, `typing`, `curious`, `bored`, `shy`, `surprised`, `squish`, `float`, and `deep-breath`. The imperative ref exposes the same control through `setIdleVariant`. `snapshot.idleVariant` reports the visible mood and `snapshot.idleVariantAmount` reports its current normalized envelope. Switching an active explicit mood back to `auto` eases the expression out before the procedural rotation resumes.

`SeamMascotBubble` automatically points the typing gaze toward its resolved placement. For a custom writing surface, pass a normalized `typingFocus={{ x, y }}` direction or call `mascotRef.current?.setTypingFocus({ x, y })`; `snapshot.typingFocus` exposes the current target.

The regular idle loop also plays a lighter version of the click reaction at long random intervals: the spikes expand, pull inward, and settle without entering the click-reaction state. `snapshot.ambientPulsing` and `snapshot.ambientPulseAmount` expose that motion, while `snapshot.curiousGaze` reports the live gaze from `-1` (left) to `1` (right).

Ambient moods and pulses are disabled under `prefers-reduced-motion`. Their overall strength and randomized quiet intervals can be tuned through `idleMotion`.

## Debug states

Lock the mascot to a form without moving it:

```tsx
<SeamMascot debugState="moving" />
```

Supported values are `auto`, `idle`, `launching`, `moving`, and `settling`.

## Motion tuning

```tsx
<SeamMascot
  motionScale={0.72}
  physics={{ maximumSpeed: 900, stiffness: 30, damping: 10.8 }}
  tailMotion={{ minimumRate: 3.2, maximumRate: 11.5, response: 6.5 }}
  timing={{ morphIn: 250, morphOut: 150, turn: 280, reaction: 400 }}
  idleMotion={{
    breathAmplitude: 0.055,
    tipAmplitude: 0.105,
    tipSpeed: 1.45,
    blinkMinimumDelay: 1800,
    blinkMaximumDelay: 5200,
    doubleBlinkChance: 0.18,
    variantStrength: 1,
    variantMinimumDelay: 1800,
    variantMaximumDelay: 4200,
    pulseStrength: 0.78,
    pulseMinimumDelay: 4800,
    pulseMaximumDelay: 9000,
    pulseDuration: 500
  }}
/>
```

Timing values are expressed in milliseconds. Changing an engine configuration object safely rebuilds the geometry; avoid recreating these objects during every render when possible.

## Development

```bash
npm install
npm run check
npm run pack:check
```

The browser test uses a locally installed Chrome binary. Set `CHROME_PATH` when Chrome is installed in a non-standard location.

Coding agents should read [AGENTS.md](AGENTS.md) before modifying or integrating the package. It documents source boundaries, public API wiring, product-tour state ownership, performance constraints, testing expectations, and the release procedure.

After changing the source demo engine or SVG paths, synchronize the package copy:

```bash
npm run sync:workspace
```
