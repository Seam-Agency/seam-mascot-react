# Agent instructions for `@seam-agency/mascot-react`

This file is the operational guide for coding agents working in this
repository or integrating the package into another React application. Follow
these instructions in addition to higher-priority user, system, and workspace
instructions.

## Mission

Maintain a small, efficient, accessible React package for Seam's procedural SVG
mascot. The mascot must feel alive without making React responsible for
per-frame animation. Product tours should be programmatically controllable,
should preserve crisp HTML text, and should expose predictable state to the
host application.

## Read before changing code

1. Read `README.md` for the public API and installation paths.
2. Read `docs/TOUR_DEMO.md` before building or changing a product tour.
3. Inspect `src/types.ts` before introducing a prop or imperative method.
4. Inspect `tests/browser-smoke.cjs` before changing motion behavior; it
   documents important runtime invariants.
5. Run `git status --short --branch` and preserve unrelated user changes.

Do not infer permission to publish, tag, force-push, rewrite history, or modify
a consumer application. Those actions require an explicit user request.

## Package facts

- Package name: `@seam-agency/mascot-react`
- Repository: `Seam-Agency/seam-mascot-react`
- Runtime: React 18.2 or newer
- Output: ESM, CommonJS, and TypeScript declarations through `tsup`
- SVG viewBox: `0 0 1200 600`
- Animation owner: one imperative `requestAnimationFrame` state machine
- HTML bubble corners/actions: `@lisse/react`
- SSR: supported
- Reduced motion: supported and required
- Public token-free install: GitHub Release tarball
- Registry publish target: GitHub Packages

## Repository map

| Path | Purpose | Editing rule |
| --- | --- | --- |
| `src/SeamMascot.tsx` | React SVG wrapper, refs, public prop wiring, event bridge | Keep React out of frame-by-frame geometry updates. |
| `src/SeamMascotBubble.tsx` | Crisp HTML bubble, placement, action, typing-focus bridge | Keep placement device-pixel aligned and independent of breathing motion. |
| `src/SeamMascotTypewriter.tsx` | Layout-stable typed text | Preserve reserved final geometry and reduced-motion behavior. |
| `src/core/mascot-machine.js` | Runtime state machine, physics, morph, eyes, idle moods | Make small deterministic changes and add browser coverage. |
| `src/core/source-paths.ts` | Normalized source SVG paths | Do not hand-edit unless intentionally replacing source artwork. |
| `src/types.ts` | Public TypeScript contract | Update whenever a public runtime field or method changes. |
| `src/index.ts` | Public exports | Export new public components/types explicitly. |
| `tests/ssr.mjs` | SSR contract | Add coverage for new server-rendered attributes or components. |
| `tests/browser-smoke.cjs` | Motion and imperative runtime contract | Add behavioral assertions for state-machine changes. |
| `docs/TOUR_DEMO.md` | Consumer product-tour guide | Keep examples aligned with the shipped API. |
| `README.md` | Package overview and public quick-start | Keep concise; link to detailed guides. |

`dist/` is generated output. Never edit it manually. Run `npm run build`.

### Important synchronization warning

`src/core/mascot-machine.js` contains a historical generated-file header and
the repository includes `npm run sync:workspace`. That command imports an
engine from a separate workspace demo. Do not run it as a routine formatting
or build step. Run it only when the user explicitly wants to synchronize that
legacy source and you have first verified that it contains every feature now
present in the package. An uninformed sync can overwrite newer package logic.

## Public components

### `SeamMascot`

Use for the SVG mascot and all motion/state behavior.

Important prop groups:

- Interaction: `interactive`, `reactionOnClick`, `paused`, `autoStart`
- State: `debugState`, `idleVariant`, `typingFocus`
- Geometry: `bounds`, `initialPosition`, `targetHeight`, `motionScale`
- Appearance: `bodyColor`, `bodyStrokeColor`, `bodyStrokeWidth`, `eyeColor`
- Trail: `ditherTrail`, `ditherTrailIntensity`, `ditherTrailScale`,
  `ditherTrailColor`
- Motion: `physics`, `tailMotion`, `timing`, `idleMotion`
- Events: `onStateChange`, `onPointerMove`, `onPointerDown`

The component renders one SVG with a fixed viewBox. Size the SVG with CSS; use
`targetHeight` to change the mascot's size inside that viewBox.

### `SeamMascotBubble`

Use for product UI text. It is an HTML overlay positioned from the mascot's
stable logical position rather than the breathing transform.

Key behavior:

- `visible` controls the built-in open/close transition. Keep the component
  mounted while hiding it.
- `placement="auto"` selects a side based on available viewport space.
- `offset`, `mascotClearance`, `edgePadding`, `nudgeX`, and `nudgeY` tune
  composition.
- `action.icon` accepts any React node, including Nucleo icon components.
- While visible, the bubble calculates a normalized vector from mascot to
  bubble and sends it through `setTypingFocus`.
- The bubble intentionally has no speech-tail arrow.

Do not attach the bubble to the mascot's animated `<g>` transform. That makes
the text breathe, blur, and lose device-pixel alignment.

### `SeamMascotTypewriter`

Use for plain text that must appear progressively without resizing its parent.

- `text`: complete final string
- `active`: pauses/resumes without losing progress
- `revealAll`: reveals the remaining text immediately
- `speed`: base character interval
- `startDelay`: delay before the first character
- `punctuationDelay`: extra pause after punctuation
- `cursor`: React node or `false`
- `onComplete`: fires once for the active text value

Use a React `key` derived from step/message identity when a fresh typing cycle
is required.

## State model

Top-level states:

- `idle`: stationary star form
- `launching`: leaving idle and increasing morph
- `moving`: velocity-driven motion form
- `settling`: slowing down and returning toward idle
- `paused`: animation paused

Idle variants are expressions inside top-level `idle`; they are not new travel
states. Supported values are:

- `auto`
- `rest`
- `typing`
- `curious`
- `bored`
- `shy`
- `surprised`
- `squish`
- `float`
- `deep-breath`

Do not add an emotion as a top-level movement state. Add it as an idle variant
unless it changes navigation semantics.

## Typing and reading-focus contract

The `typing` expression must represent actual text generation.

Required lifecycle for every message:

```tsx
function beginMessage(nextIndex: number) {
  setMessageIndex(nextIndex);
  setTypingComplete(false);
  setRevealAll(false);
  mascotRef.current?.setIdleVariant("typing");
}

function completeMessage() {
  setTypingComplete(true);
  mascotRef.current?.setIdleVariant("auto");
}
```

Do not limit typing to `messageIndex === 0`. Every title/body pair should enter
typing while it is being written.

The current typing behavior has these invariants:

1. Horizontal focus stays toward the writing surface; it does not alternate
   left/right like the curious mood.
2. Both eyes perform the same small vertical reading scan.
3. Focus direction comes from `SeamMascotBubble` automatically or from
   `typingFocus` / `setTypingFocus` manually.
4. The normalized focus vector never exceeds length `1`.
5. Returning from explicit `typing` to `auto` eases out before ambient moods
   resume.

When changing this behavior, update the browser test to assert direction,
vertical range, synchronized eyes, and smooth release.

## Product-tour architecture

Read `docs/TOUR_DEMO.md` for the copyable controller. The required architecture
is summarized here for agents:

### Data

- A tour contains ordered locations.
- A location contains one or more ordered messages.
- Each location identifies a real DOM target and an offset.
- Message identity must be stable and suitable for React keys.

### Phase ownership

Use `booting`, `moving`, and `arrived`.

- Before movement: set idle variant to `rest`, hide the bubble, clear message
  completion state.
- During movement: ignore Continue and prevent message typing.
- After confirmed arrival: show the bubble and set `typing`.
- After text completion: set `auto` but remain in `arrived`.

Keep mirror refs such as `phaseRef` when callbacks are invoked by the animation
machine; this prevents stale React closures without subscribing React to every
frame.

### Arrival guard

The mascot begins idle. Therefore `snapshot.state === "idle"` alone does not
mean it arrived. Track whether it actually departed, then accept arrival only
when:

```ts
departed && snapshot.state === "idle" && !snapshot.hasTarget
```

### Coordinate conversion

DOM targets use viewport pixels. The mascot uses SVG coordinates. Convert with
`svg.getScreenCTM().inverse()` and `svg.createSVGPoint()`. Never pass raw
`getBoundingClientRect()` values to `moveTo({ unit: "svg" })`.

For normalized positions, omit `unit` or use `unit: "progress"` and values in
the `0..1` range.

### Continue behavior

One Continue action has two phases:

1. If typing is incomplete, set `revealAll` and remain on the message.
2. Otherwise advance to the next message; after the final message, move to the
   next location.

Use an accurate `ariaLabel` for the current action.

### Previous behavior

- If a previous message exists at the current location, select it and start a
  fresh typing cycle.
- Otherwise move to the previous location and select its final message if that
  matches the product's navigation model.
- Do not teleport while the phase is `moving`.

## Motion rules

1. Never put frame-by-frame coordinates in React state.
2. Never create a second animation loop for an effect that can be derived in
   the existing machine render pass.
3. Use explicit transition properties; do not use `transition: all`.
4. Respect the existing open/close asymmetry: bubble open `250ms`, close
   `150ms` with smooth-out easing.
5. Keep typing focus smooth and low amplitude; it should read as attention,
   not eye vibration.
6. Preserve random idle timing and avoid synchronized procedural motion.
7. Velocity may affect moving-tail rate, but idle expression timing must not be
   coupled to pointer sampling frequency.
8. Keep `prefers-reduced-motion` behavior functional after every motion change.

## Styling and themes

The mascot body and trail colors are independent:

```tsx
<SeamMascot
  bodyColor="#ffffff"
  bodyStrokeColor="#050505"
  bodyStrokeWidth={1.5}
  eyeColor="#050505"
  ditherTrailColor="#8f7cff"
/>
```

For a light surface, consumers may use a black body directly:

```tsx
<SeamMascot
  bodyColor="#050505"
  eyeColor="#ffffff"
  ditherTrailColor="#050505"
/>
```

Do not hardcode a global page background inside the package. The consumer owns
the scene. Preserve transparent SVG behavior.

## Dither trail rules

- It is opt-in through `ditherTrail`.
- `ditherTrailIntensity={0}` is a valid subtle preset, not equivalent to
  disabling the effect.
- `ditherTrailScale` changes footprint without changing density semantics.
- Trail origin must appear inside the moving tail, not detached from the body
  or emitted from a sharp tip.
- WebGL failure must leave the mascot usable.
- Pixel-trail experiments are not part of the production package unless the
  user explicitly asks to restore them.

## Accessibility

Required behavior:

- Preserve `role="img"` and a useful `aria-label` on `SeamMascot`.
- Give bubble actions explicit accessible labels when the visible label is not
  sufficient.
- Use `aria-live="polite"` for tour copy when appropriate.
- Keep previous/next/Continue controls keyboard reachable.
- Preserve visible focus styles.
- Do not require hover for progression.
- Do not make completion depend on animation events in reduced-motion mode.
- Keep `prefers-reduced-motion` guards in all shipped transitions.

## SSR and browser boundaries

- Do not access `window`, `document`, SVG geometry, or WebGL during React
  render.
- Access browser APIs inside effects or the runtime after mounting.
- Keep SSR output deterministic.
- Add an assertion to `tests/ssr.mjs` when a new data attribute or public
  component changes server output.

## Performance constraints

- React should render configuration and semantic state only.
- The machine mutates SVG path attributes inside one animation frame loop.
- Use refs for callbacks consumed by the machine.
- Avoid recreating `physics`, `timing`, `tailMotion`, `idleMotion`, `bounds`, or
  other configuration objects every render. Memoize computed objects.
- Avoid layout reads inside the state-machine render loop.
- `SeamMascotBubble` may read position once per frame because it is a separate
  viewport overlay; avoid extra per-element reads.
- When adding a bubble measurement, batch reads before writes.

## Public API change checklist

When adding or changing a public prop, method, event, snapshot field, or type:

1. Update the runtime implementation.
2. Update `src/types.ts`.
3. Wire the prop/method through `src/SeamMascot.tsx`.
4. Export any new public type from `src/index.ts`.
5. Update README or the relevant detailed guide.
6. Add SSR or browser coverage.
7. Run the complete validation commands.
8. Inspect the generated `.d.ts` output and tarball contents.

Avoid a new public option when existing composition or the imperative handle
already solves the use case cleanly.

## Testing commands

Use the repository root for all commands:

```bash
npm ci
npm run typecheck
npm run test:ssr
npm run test:browser
npm run check
npm run pack:check
```

`npm run check` is the required local gate. It performs typecheck, build, SSR
smoke testing, and browser motion testing.

The browser test expects a local Chrome installation. Set `CHROME_PATH` only
when Chrome is not found at the standard Windows paths.

For a consumer tour demo, also run that application's own typecheck and
production build. Do not treat package tests as proof that host CSS and target
coordinates are correct.

## Browser-test expectations

Prefer behavioral assertions over screenshots for motion internals:

- state and target lifecycle
- morph direction and settling
- eye bounds and offsets
- idle variant envelope
- typing focus direction
- synchronized vertical reading range
- smooth explicit-to-auto release
- randomized blink duration/range
- reduced-motion behavior

Use screenshots only for composition, clipping, contrast, or surface quality.

## Documentation rules

- Keep examples in English unless the user requests another language.
- Use package-name imports, never relative imports into `src` or `dist`.
- Show token-free installation first.
- Explain GitHub Packages authentication separately.
- Do not include secrets, license keys, personal paths, or auth tokens.
- Keep README examples short and move full controllers into `docs/`.
- Ensure every documented method exists in `src/types.ts`.

## Git and release procedure

Only release when explicitly requested.

1. Confirm the worktree contains only intended changes.
2. Choose the SemVer level:
   - patch: compatible fix, docs, or small behavior refinement
   - minor: backward-compatible public feature
   - major: breaking public API or behavior
3. Update `package.json` and `package-lock.json` to the same version.
4. Run `npm run check`.
5. Run `npm run pack:check` and confirm only intended files ship.
6. Commit with an accurate message.
7. Push `main` and wait for CI success.
8. Create and push an annotated `vX.Y.Z` tag.
9. Create the GitHub Release.
10. Wait for the publish workflow.
11. Verify the token-free asset:

```text
https://github.com/Seam-Agency/seam-mascot-react/releases/latest/download/seam-mascot-react.tgz
```

12. Verify the asset returns HTTP 200 and matches the expected tarball size.

Do not reuse a published version. Do not force-push or rewrite tags unless the
user explicitly asks for history rewriting.

## Package-content policy

The npm tarball should contain only:

- `dist/`
- `README.md`
- `AGENTS.md`
- `docs/`
- `package.json`

Do not accidentally include workspace videos, analysis frames, source images,
temporary archives, browser screenshots, credentials, or unrelated demo
experiments.

## Common failure modes

### Mascot appears idle but cannot react

Use `snapshot.canReact` and visible morph eligibility. Do not rely only on the
nominal top-level state.

### Bubble moves with breathing

The bubble was probably attached to the animated `<g>` or measured from its
visual transform. Use `SeamMascotBubble` and the stable snapshot position.

### Bubble text looks blurred

Do not render product copy inside a transformed SVG group. Use the HTML bubble,
avoid scale animation after opening, and keep device-pixel rounding.

### Typing gaze alternates left and right

Do not use `curiousGaze` for typing. Provide a fixed writing-surface vector
through `setTypingFocus`; let only the vertical reading scan loop.

### Only the first message uses typing

Move `setIdleVariant("typing")` into the function that begins every message,
not the function that begins only a location.

### Bubble appears before travel

The controller treated the mascot's initial idle state as arrival. Require a
confirmed departure before accepting idle/no-target as arrival.

### Movement target is offset after resize

The controller stored stale viewport coordinates or skipped `getScreenCTM()`.
Recompute from the target element and current SVG matrix.

### A build works but consumers see old behavior

The package `dist/` was not rebuilt, or a Vite consumer cached the file
dependency while `dist/` was temporarily absent. Run `npm run build`, then
reload the consumer after the build completes.

### `sync:workspace` removes recent features

The external legacy demo engine is behind the package runtime. Restore the
package changes and do not sync again until both sources are deliberately
reconciled.

## Completion definition

A task is complete only when:

- the requested behavior exists in source;
- public types and docs agree with runtime behavior;
- package tests pass;
- the consumer demo typechecks/builds when it is part of scope;
- browser verification covers the requested interaction when visual or state
  behavior changed;
- the worktree contains no accidental generated or temporary files;
- publishing has been verified remotely when the user requested a release.

