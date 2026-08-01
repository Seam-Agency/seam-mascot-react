# @seam-agency/mascot-react

A lightweight React component for Seam's procedural SVG mascot. It morphs from an organic idle star into a directional motion form.

- Runs animation through a single `requestAnimationFrame` state machine without re-rendering React on every frame.
- Follows the pointer across both axes using velocity, acceleration, and spring physics.
- Includes velocity-reactive tail motion, a neutral direction-change bridge, and procedural idle breathing.
- Can render an opt-in WebGL dither trail directly from the moving form's two tail tips.
- Plays a coordinated spike pop and blink whenever its visible form is idle-ready.
- Blinks procedurally during idle with randomized timing and occasional double blinks.
- Rotates through distinct ambient idle moods without leaving the top-level `idle` state.
- Supports server-side rendering and respects `prefers-reduced-motion`.
- Ships with TypeScript declarations and no runtime dependencies beyond React.

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

The ref also exposes `start`, `pause`, `resume`, `playReaction`, `follow`, `setState`, `setDebugState`, `setIdleVariant`, `send`, `getSnapshot`, and `getMachine`.

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
  >
    Create from one clear idea.
  </SeamMascotBubble>
</>
```

Keep it mounted and toggle `visible` for the built-in origin-aware popover transition. The surface opens from the corner nearest the mascot in 250ms and retracts in 150ms without blurring the text. `placement`, `offset`, `mascotClearance`, `edgePadding`, `nudgeX`, and `nudgeY` control its layout; a negative `nudgeY` creates a compact upper-diagonal composition. Use `surfaceClassName` or `surfaceStyle` to customize the surface; interactive content is supported.

The original SVG-contained `speechBubble` and `speechBubbleOptions` props remain available for self-contained SVG exports. Use `SeamMascotBubble` for product UI where native-resolution text matters.

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

The default `idleVariant="auto"` mode gives the stationary mascot four occasional behaviors: a curious glance and tilt, a soft squish, a gentle float, and a deeper breath. Curious mode now alternates its gaze between left and right at procedural intervals instead of locking the eyes to one side. Each behavior enters and leaves through a short smooth-out transition while the machine remains in `idle`, so application logic listening to the top-level state stays stable.

Lock a mood while tuning or presenting it:

```tsx
<SeamMascot idleVariant="curious" />
```

Supported values are `auto`, `rest`, `curious`, `squish`, `float`, and `deep-breath`. The imperative ref exposes the same control through `setIdleVariant`. `snapshot.idleVariant` reports the visible mood and `snapshot.idleVariantAmount` reports its current normalized envelope.

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

After changing the source demo engine or SVG paths, synchronize the package copy:

```bash
npm run sync:workspace
```
