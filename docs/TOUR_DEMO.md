# Building a product tour

This guide shows how to combine `SeamMascot`, `SeamMascotBubble`, and
`SeamMascotTypewriter` into a multi-location product tour. It covers the parts
that are easy to get subtly wrong: coordinate conversion, arrival detection,
multiple messages at one location, typing-state ownership, and bubble-aware
reading focus.

## Install

Token-free installation from the latest public GitHub release:

```bash
npm install https://github.com/Seam-Agency/seam-mascot-react/releases/latest/download/seam-mascot-react.tgz
```

Imports still use the package name:

```tsx
import {
  SeamMascot,
  SeamMascotBubble,
  SeamMascotTypewriter,
  type MascotSnapshot,
  type SeamMascotHandle
} from "@seam-agency/mascot-react";
```

## Component responsibilities

| Component | Responsibility |
| --- | --- |
| `SeamMascot` | Owns movement, morphing, idle moods, eye expression, and the procedural animation loop. |
| `SeamMascotBubble` | Positions crisp HTML content beside the mascot and automatically sends its direction to the typing gaze. |
| `SeamMascotTypewriter` | Reveals one text value while reserving the final layout size from the first frame. |
| Tour controller | Owns locations, message order, travel/arrival state, Continue behavior, and when `typing` becomes `auto`. |

Keep the tour controller in React state. Keep per-frame animation inside the
mascot machine; do not update React state on every mascot frame.

## Recommended state model

Use three travel phases:

```ts
type TourPhase = "booting" | "moving" | "arrived";
```

- `booting`: the first location has not been requested yet.
- `moving`: the bubble is hidden and the mascot has an active destination.
- `arrived`: the bubble is visible and the current message may type.

Each location contains one or more messages:

```ts
interface TourMessage {
  id: string;
  title: string;
  description: string;
}

interface TourStep {
  id: string;
  targetId: string;
  offsetX: number;
  offsetY: number;
  messages: TourMessage[];
}
```

The offset is expressed in CSS pixels relative to the target element. It keeps
the mascot from covering the control it is explaining.

## Converting an element position to mascot coordinates

`getBoundingClientRect()` returns viewport pixels, while `moveTo` with
`unit: "svg"` expects coordinates inside the mascot's `0 0 1200 600` viewBox.
Convert through the SVG screen matrix:

```tsx
import type { RefObject } from "react";
import type { SeamMascotHandle } from "@seam-agency/mascot-react";

function moveMascotToElement(
  mascotRef: RefObject<SeamMascotHandle | null>,
  target: HTMLElement,
  offset: { x: number; y: number }
) {
  const svg = mascotRef.current?.getElement();
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return false;

  const rect = target.getBoundingClientRect();
  const point = svg.createSVGPoint();
  point.x = rect.left + rect.width / 2 + offset.x;
  point.y = rect.top + rect.height / 2 + offset.y;

  const local = point.matrixTransform(matrix.inverse());
  mascotRef.current?.moveTo({ x: local.x, y: local.y, unit: "svg" });
  return true;
}
```

Re-run this conversion on viewport resize only when the tour is in `arrived`.
Do not continuously call `moveTo` while the mascot is settling.

## Typing lifecycle

Every message—not only the first message at a location—should use this
lifecycle:

1. The message becomes active.
2. Set the mascot idle variant to `typing`.
3. Start the title and body typewriters.
4. If Continue is pressed before completion, reveal the current message.
5. When the final typewriter completes, set the mascot back to `auto`.
6. A later Continue advances to the next message or location.

This keeps the expression semantically tied to actual writing. `typing` is an
explicit state and is intentionally not part of the random ambient rotation.

`SeamMascotBubble` measures its resolved position relative to the mascot and
calls `setTypingFocus` automatically. The eyes therefore hold their horizontal
focus toward the text while performing a small synchronized vertical reading
scan. When using a custom popover, set the normalized direction manually:

```tsx
mascotRef.current?.setTypingFocus({ x: -0.9, y: -0.3 });
mascotRef.current?.setIdleVariant("typing");
```

Both values are normalized to a maximum vector length of `1`:

- `x: -1` looks fully left; `x: 1` looks fully right.
- `y: -1` looks up; `y: 1` looks down.
- `snapshot.typingFocus` exposes the current normalized direction.

## Reference controller

The following controller demonstrates the complete flow. Replace the sample
steps and target lookup with the structure used by your product.

```tsx
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  SeamMascot,
  SeamMascotBubble,
  SeamMascotTypewriter,
  type MascotSnapshot,
  type SeamMascotHandle
} from "@seam-agency/mascot-react";

type TourPhase = "booting" | "moving" | "arrived";

interface TourMessage {
  id: string;
  title: string;
  description: string;
}

interface TourStep {
  id: string;
  targetId: string;
  offsetX: number;
  offsetY: number;
  messages: TourMessage[];
}

const STEPS: TourStep[] = [
  {
    id: "create",
    targetId: "create-button",
    offsetX: 56,
    offsetY: 36,
    messages: [
      {
        id: "idea",
        title: "Start with one clear idea.",
        description: "Use a prompt, link or blank canvas."
      },
      {
        id: "brand",
        title: "Bring the brand into focus.",
        description: "Keep voice, colors and references nearby."
      }
    ]
  },
  {
    id: "publish",
    targetId: "publish-button",
    offsetX: -56,
    offsetY: -36,
    messages: [
      {
        id: "review",
        title: "Review once.",
        description: "Approve the final result before publishing."
      }
    ]
  }
];

export function ProductTour() {
  const mascotRef = useRef<SeamMascotHandle | null>(null);
  const stepIndexRef = useRef(0);
  const phaseRef = useRef<TourPhase>("booting");
  const departedRef = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState<TourPhase>("booting");
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);
  const [revealAll, setRevealAll] = useState(false);

  const step = STEPS[stepIndex];
  const message = step.messages[messageIndex];

  const beginMessage = useCallback((nextMessageIndex: number) => {
    setMessageIndex(nextMessageIndex);
    setTypingComplete(false);
    setRevealAll(false);
    if (phaseRef.current === "arrived") {
      mascotRef.current?.setIdleVariant("typing");
    }
  }, []);

  const goToStep = useCallback((requestedIndex: number) => {
    const nextIndex =
      (requestedIndex + STEPS.length) % STEPS.length;
    const nextStep = STEPS[nextIndex];

    mascotRef.current?.setIdleVariant("rest");
    stepIndexRef.current = nextIndex;
    phaseRef.current = "moving";
    departedRef.current = false;
    setStepIndex(nextIndex);
    setMessageIndex(0);
    setPhase("moving");
    setBubbleVisible(false);
    setTypingComplete(false);
    setRevealAll(false);

    requestAnimationFrame(() => {
      const target = document.getElementById(nextStep.targetId);
      if (!target) return;

      const svg = mascotRef.current?.getElement();
      const matrix = svg?.getScreenCTM();
      if (!svg || !matrix) return;

      const rect = target.getBoundingClientRect();
      const point = svg.createSVGPoint();
      point.x = rect.left + rect.width / 2 + nextStep.offsetX;
      point.y = rect.top + rect.height / 2 + nextStep.offsetY;
      const local = point.matrixTransform(matrix.inverse());
      mascotRef.current?.moveTo({ x: local.x, y: local.y, unit: "svg" });
    });
  }, []);

  const handleStateChange = useCallback((snapshot: MascotSnapshot) => {
    if (phaseRef.current !== "moving") return;

    if (snapshot.hasTarget || snapshot.state !== "idle") {
      departedRef.current = true;
    }

    if (
      departedRef.current &&
      snapshot.state === "idle" &&
      !snapshot.hasTarget
    ) {
      phaseRef.current = "arrived";
      setPhase("arrived");
      setBubbleVisible(true);
      mascotRef.current?.setIdleVariant("typing");
    }
  }, []);

  const handleTypingComplete = useCallback(() => {
    setTypingComplete(true);
    if (phaseRef.current === "arrived") {
      mascotRef.current?.setIdleVariant("auto");
    }
  }, []);

  const handleContinue = () => {
    if (phase === "moving") return;

    if (!typingComplete) {
      setRevealAll(true);
      return;
    }

    if (messageIndex < step.messages.length - 1) {
      beginMessage(messageIndex + 1);
      return;
    }

    goToStep(stepIndex + 1);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => goToStep(0), 250);
    return () => window.clearTimeout(timer);
  }, [goToStep]);

  return (
    <div className="product-tour">
      <div className="product-tour__mascot-layer">
        <SeamMascot
          ref={mascotRef}
          interactive={false}
          reactionOnClick={false}
          idleVariant="auto"
          targetHeight={50}
          motionScale={0.6}
          bodyColor="#ffffff"
          bodyStrokeColor="#050505"
          bodyStrokeWidth={1.5}
          eyeColor="#050505"
          onStateChange={handleStateChange}
        />
      </div>

      <SeamMascotBubble
        mascotRef={mascotRef}
        visible={bubbleVisible}
        placement="auto"
        theme="dark"
        nudgeY={-56}
        action={{
          label: "Continue",
          disabled: phase === "moving",
          onClick: handleContinue
        }}
      >
        <div key={`${step.id}:${message.id}`} className="tour-copy">
          <strong>
            <SeamMascotTypewriter
              text={message.title}
              active={phase === "arrived"}
              revealAll={revealAll}
              speed={22}
              startDelay={100}
              punctuationDelay={80}
            />
          </strong>
          <span>
            <SeamMascotTypewriter
              text={message.description}
              active={phase === "arrived"}
              revealAll={revealAll}
              speed={16}
              startDelay={240}
              punctuationDelay={70}
              onComplete={handleTypingComplete}
            />
          </span>
        </div>
      </SeamMascotBubble>
    </div>
  );
}
```

## Minimal layout CSS

The SVG must cover the same visual area as the tour targets. The bubble itself
uses `position: fixed`, so it does not need to share the target container.

```css
.product-tour {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  background: #050505;
}

.product-tour__mascot-layer {
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.product-tour__mascot-layer > svg {
  width: 100%;
  height: 100%;
}

.tour-copy {
  display: grid;
  width: min(340px, calc(100vw - 64px));
  min-height: 64px;
  gap: 2px;
}

.tour-copy strong,
.tour-copy span {
  display: block;
}
```

Give the copy surface a stable width and minimum height. The typewriter already
reserves final text geometry, but the container dimensions make the tour feel
consistent across messages.

## Continue-button semantics

Use one button for two intentional actions:

- While typing: reveal the complete current message.
- After typing: advance to the next message or location.

Update the accessible name so assistive technology receives the same meaning:

```tsx
action={{
  label: "Continue",
  ariaLabel: !typingComplete
    ? "Show the complete message"
    : messageIndex < step.messages.length - 1
      ? "Continue to the next message"
      : "Continue to the next guide location",
  onClick: handleContinue
}}
```

## Arrival detection

Do not show the bubble merely because `snapshot.state` is currently `idle`.
The mascot begins in idle, so that would reveal the first bubble before travel.
Require all three conditions:

1. The tour requested movement.
2. The mascot actually departed (`hasTarget` or a non-idle state was observed).
3. The mascot later returned to `idle` with `hasTarget === false`.

The `departedRef` in the reference controller implements this guard.

## Resizing and responsive placement

- Let `SeamMascotBubble placement="auto"` choose the clearest side.
- Use `edgePadding` to protect viewport edges.
- Use `mascotClearance` to reserve the visible mascot radius.
- Use `nudgeX` and `nudgeY` only for visual composition.
- Recalculate the mascot destination after a viewport resize while arrived.
- Avoid storing viewport coordinates permanently; they become stale after zoom,
  resize, font loading, or responsive layout changes.

## Reduced motion

The package respects `prefers-reduced-motion`:

- Mascot movement resolves without decorative interpolation.
- Typewriter content becomes immediately available.
- Bubble transitions are disabled.
- Ambient moods and dither motion are suppressed where appropriate.

The tour controller must still handle `onComplete` and the arrival state. Do
not make progression depend on a CSS animation event.

## Testing checklist

Verify at least the following:

1. The mascot reaches every target at desktop and narrow viewport widths.
2. The bubble never covers the target it describes.
3. Every message enters `typing`, including the second and later messages at a
   location.
4. Both eyes focus toward the resolved bubble side and scan vertically
   together.
5. Continue reveals unfinished copy before it advances.
6. The final message advances to the next location.
7. Resizing preserves the current location.
8. Reduced-motion mode exposes complete text and remains navigable.
9. Previous/next controls are disabled while moving.
10. No React state update runs once per animation frame.

## Common mistakes

- **Typing only the first message:** call `setIdleVariant("typing")` whenever a
  new message begins, not only when a location begins.
- **Keeping typing after completion:** return to `auto` from the last
  typewriter's `onComplete` callback.
- **Alternating the eyes manually:** the packaged typing expression already
  performs a synchronized reading scan.
- **Hardcoding gaze direction:** use `SeamMascotBubble` or call
  `setTypingFocus` from the actual surface position.
- **Using viewport pixels in `moveTo`:** convert through `getScreenCTM()` or use
  normalized progress coordinates.
- **Treating the initial idle state as arrival:** require a confirmed departure.
- **Unmounting the bubble to close it:** keep it mounted and toggle `visible` so
  its open/close transition can complete.
- **Recreating option objects every render:** memoize `physics`, `timing`, and
  `idleMotion` objects when they are computed dynamically.

