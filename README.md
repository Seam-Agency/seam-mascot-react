# @seam-agency/mascot-react

A lightweight React component for Seam's procedural SVG mascot. It morphs from an organic idle star into a directional motion form.

- Runs animation through a single `requestAnimationFrame` state machine without re-rendering React on every frame.
- Follows the pointer across both axes using velocity, acceleration, and spring physics.
- Includes velocity-reactive tail motion, a neutral direction-change bridge, and procedural idle breathing.
- Plays a coordinated spike pop and blink when clicked while idle or settling.
- Blinks procedurally during idle with randomized timing and occasional double blinks.
- Supports server-side rendering and respects `prefers-reduced-motion`.
- Ships with TypeScript declarations and no runtime dependencies beyond React.

## Installation

Configure the GitHub Packages registry in your project's `.npmrc`:

```ini
@seam-agency:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then install the package:

```bash
npm install @seam-agency/mascot-react
```

Installing this private package locally requires a token with the `read:packages` permission. Keep the token out of source control and provide it through the `NODE_AUTH_TOKEN` environment variable.

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

The ref also exposes `start`, `pause`, `resume`, `playReaction`, `follow`, `setState`, `setDebugState`, `send`, `getSnapshot`, and `getMachine`.

## Click reaction

Clicking the mascot while it is idle or settling pushes every spike slightly beyond its resting shape, pulls them inward, and releases them while the eyes blink once. It also works with `debugState="idle"`, so the interaction responds before the full idle transition has completed. The 400ms reaction uses the transitions.dev smooth-out curve between phases.

Disable the interaction or trigger it manually with the ref API:

```tsx
<SeamMascot reactionOnClick={false} />

<button onClick={() => mascot.current?.playReaction()}>React</button>
```

The reaction is skipped when `prefers-reduced-motion: reduce` is active.

Independent idle blinks use a randomized `1800–5200ms` delay and `110–180ms` duration by default. Approximately 18% of them become a short double blink. The scheduler also runs in fixed idle debug mode and pauses during click reactions.

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
    doubleBlinkChance: 0.18
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
