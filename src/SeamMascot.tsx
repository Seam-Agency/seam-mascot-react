import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent
} from "react";
import {
  DitherTrail,
  type DitherTrailSource
} from "./DitherTrail.js";
import { MascotStateMachine as RuntimeMascotStateMachine } from "./core/mascot-machine.js";
import { SOURCE_PATHS } from "./core/source-paths.js";
import type {
  MascotBounds,
  MascotMachine,
  MascotSnapshot,
  SeamMascotHandle,
  SeamMascotProps
} from "./types.js";

const DEFAULT_BOUNDS: MascotBounds = {
  minimumX: 55,
  maximumX: 1145,
  minimumY: 55,
  maximumY: 545
};

const SPEECH_BUBBLE_STYLES = `
  [data-seam-speech-bubble] {
    opacity: 0;
    filter: blur(2px);
    pointer-events: none;
    transition:
      opacity var(--seam-speech-close-duration, 150ms) var(--seam-speech-ease, cubic-bezier(0.22, 1, 0.36, 1)),
      filter var(--seam-speech-close-duration, 150ms) var(--seam-speech-ease, cubic-bezier(0.22, 1, 0.36, 1));
    will-change: opacity, filter;
  }

  [data-seam-speech-bubble][data-visible="true"] {
    opacity: 1;
    filter: blur(0);
    pointer-events: auto;
    transition-duration: var(--seam-speech-open-duration, 250ms);
  }

  [data-seam-speech-popover] {
    position: relative;
    width: 100%;
    height: 100%;
    transform: scale(var(--seam-speech-rest-scale, 0.96));
    transform-origin: bottom center;
    transition: transform var(--seam-speech-close-duration, 150ms) var(--seam-speech-ease, cubic-bezier(0.22, 1, 0.36, 1));
    will-change: transform;
  }

  [data-seam-speech-bubble][data-visible="true"] [data-seam-speech-popover] {
    transform: scale(1);
    transition-duration: var(--seam-speech-open-duration, 250ms);
  }

  [data-seam-speech-bubble][data-placement="bottom"] [data-seam-speech-popover] {
    transform-origin: top center;
  }

  [data-seam-speech-bubble][data-placement="left"] [data-seam-speech-popover] {
    transform-origin: center right;
  }

  [data-seam-speech-bubble][data-placement="right"] [data-seam-speech-popover] {
    transform-origin: center left;
  }

  [data-seam-speech-surface] {
    position: relative;
    z-index: 1;
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
    justify-content: center;
    padding: 20px 22px;
    overflow: hidden;
    box-sizing: border-box;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: -0.015em;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22), 0 2px 10px rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(18px);
  }

  [data-seam-speech-message] {
    display: block;
    overflow: hidden;
    font-size: 15px;
    font-weight: 540;
    line-height: 1.42;
  }

  [data-seam-speech-tail] {
    position: absolute;
    z-index: 0;
    width: var(--seam-speech-tail-size, 10px);
    height: var(--seam-speech-tail-size, 10px);
    box-sizing: border-box;
    transform: rotate(45deg);
  }

  [data-seam-speech-bubble][data-placement="top"] [data-seam-speech-tail] {
    bottom: calc(var(--seam-speech-tail-size, 10px) * -0.42);
    left: var(--seam-speech-tip-x, 50%);
    margin-left: calc(var(--seam-speech-tail-size, 10px) * -0.5);
  }

  [data-seam-speech-bubble][data-placement="bottom"] [data-seam-speech-tail] {
    top: calc(var(--seam-speech-tail-size, 10px) * -0.42);
    left: var(--seam-speech-tip-x, 50%);
    margin-left: calc(var(--seam-speech-tail-size, 10px) * -0.5);
  }

  [data-seam-speech-bubble][data-placement="left"] [data-seam-speech-tail] {
    top: var(--seam-speech-tip-y, 50%);
    right: calc(var(--seam-speech-tail-size, 10px) * -0.42);
    margin-top: calc(var(--seam-speech-tail-size, 10px) * -0.5);
  }

  [data-seam-speech-bubble][data-placement="right"] [data-seam-speech-tail] {
    top: var(--seam-speech-tip-y, 50%);
    left: calc(var(--seam-speech-tail-size, 10px) * -0.42);
    margin-top: calc(var(--seam-speech-tail-size, 10px) * -0.5);
  }

  @media (prefers-reduced-motion: reduce) {
    [data-seam-speech-bubble],
    [data-seam-speech-popover] {
      transition: none !important;
    }
  }
`;

type RuntimeConstructor = new (options: Record<string, unknown>) => MascotMachine;
const MascotRuntime = RuntimeMascotStateMachine as RuntimeConstructor;

function stableConfigKey(value: unknown): string {
  return JSON.stringify(value);
}

export const SeamMascot = forwardRef<SeamMascotHandle, SeamMascotProps>(
  function SeamMascot(
    {
      interactive = true,
      autoStart = true,
      paused = false,
      reactionOnClick = true,
      debugState = "auto",
      idleVariant = "auto",
      typingFocus,
      ditherTrail = false,
      ditherTrailIntensity = 0,
      ditherTrailScale = 1,
      ditherTrailColor,
      speechBubble,
      speechBubbleOptions,
      bodyColor = "#ffffff",
      bodyStrokeColor = "none",
      bodyStrokeWidth = 0,
      eyeColor = "#050505",
      bounds,
      initialPosition,
      targetHeight = 92,
      motionScale = 0.72,
      bodySamples = 72,
      eyeSamples = 24,
      physics,
      tailMotion,
      timing,
      idleMotion,
      onStateChange,
      onPointerMove,
      onPointerDown,
      style,
      role = "img",
      "aria-label": ariaLabel = "Seam mascot",
      ...svgProps
    },
    forwardedRef
  ) {
    const svgRef = useRef<SVGSVGElement>(null);
    const rootRef = useRef<SVGGElement>(null);
    const bodyRef = useRef<SVGPathElement>(null);
    const leftEyeRef = useRef<SVGPathElement>(null);
    const rightEyeRef = useRef<SVGPathElement>(null);
    const speechBubbleRef = useRef<SVGForeignObjectElement>(null);
    const starBodyRef = useRef<SVGPathElement>(null);
    const starLeftEyeRef = useRef<SVGPathElement>(null);
    const starRightEyeRef = useRef<SVGPathElement>(null);
    const motionBodyRef = useRef<SVGPathElement>(null);
    const motionLeftEyeRef = useRef<SVGPathElement>(null);
    const motionRightEyeRef = useRef<SVGPathElement>(null);
    const machineRef = useRef<MascotMachine | null>(null);
    const ditherSourceRef = useRef<DitherTrailSource>({
      x: 0.5,
      y: 0.5,
      active: false
    });
    const onStateChangeRef = useRef(onStateChange);

    onStateChangeRef.current = onStateChange;

    const speechBubbleMounted =
      speechBubble !== null && speechBubble !== undefined;
    const speechBubbleVisible =
      speechBubbleOptions?.visible ?? speechBubbleMounted;
    const speechBubblePlacement = speechBubbleOptions?.placement ?? "auto";
    const speechBubbleWidth = Math.max(112, speechBubbleOptions?.width ?? 220);
    const speechBubbleHeight = Math.max(58, speechBubbleOptions?.height ?? 104);
    const speechBubbleOffset = Math.max(6, speechBubbleOptions?.offset ?? 18);
    const speechBubbleTheme = speechBubbleOptions?.theme ?? "auto";
    const speechBubbleTailSize = Math.max(
      6,
      speechBubbleOptions?.tailSize ?? 10
    );
    const themePalette = speechBubbleTheme === "dark"
      ? {
          background: "rgba(246, 245, 240, 0.98)",
          color: "#0a0a0b",
          border: "rgba(255, 255, 255, 0.72)"
        }
      : speechBubbleTheme === "light"
        ? {
            background: "rgba(10, 10, 11, 0.98)",
            color: "#f6f5f0",
            border: "rgba(10, 10, 11, 0.72)"
          }
        : {
            background: "light-dark(rgba(10, 10, 11, 0.98), rgba(246, 245, 240, 0.98))",
            color: "light-dark(#f6f5f0, #0a0a0b)",
            border: "light-dark(rgba(10, 10, 11, 0.72), rgba(255, 255, 255, 0.72))"
          };
    const speechBubbleBackground =
      speechBubbleOptions?.backgroundColor ?? themePalette.background;
    const speechBubbleColor = speechBubbleOptions?.color ?? themePalette.color;
    const speechBubbleBorder =
      speechBubbleOptions?.borderColor ?? themePalette.border;
    const speechBubbleRadius = Math.max(
      8,
      speechBubbleOptions?.borderRadius ?? 22
    );

    const resolvedBounds = useMemo<MascotBounds>(
      () => ({ ...DEFAULT_BOUNDS, ...bounds }),
      [
        bounds?.minimumX,
        bounds?.maximumX,
        bounds?.minimumY,
        bounds?.maximumY
      ]
    );

    const machineConfigKey = stableConfigKey({
      bounds: resolvedBounds,
      initialPosition,
      targetHeight,
      motionScale,
      bodySamples,
      eyeSamples,
      physics,
      tailMotion,
      timing,
      idleMotion,
      speechBubbleMounted,
      speechBubblePlacement,
      speechBubbleWidth,
      speechBubbleHeight,
      speechBubbleOffset
    });

    useEffect(() => {
      const elements = {
        root: rootRef.current,
        body: bodyRef.current,
        leftEye: leftEyeRef.current,
        rightEye: rightEyeRef.current,
        starBody: starBodyRef.current,
        starLeftEye: starLeftEyeRef.current,
        starRightEye: starRightEyeRef.current,
        motionBody: motionBodyRef.current,
        motionLeftEye: motionLeftEyeRef.current,
        motionRightEye: motionRightEyeRef.current
      };

      if (Object.values(elements).some((element) => element === null)) return;
      if (speechBubbleMounted && !speechBubbleRef.current) return;

      const machine = new MascotRuntime({
        root: elements.root,
        body: elements.body,
        eyes: [elements.leftEye, elements.rightEye],
        sources: {
          star: {
            body: elements.starBody,
            eyes: [elements.starLeftEye, elements.starRightEye]
          },
          motion: {
            body: elements.motionBody,
            eyes: [elements.motionLeftEye, elements.motionRightEye]
          }
        },
        bounds: resolvedBounds,
        initialPosition,
        targetHeight,
        motionScale,
        bodySamples,
        eyeSamples,
        physics,
        tailMotion,
        timing,
        idleMotion,
        idleVariant,
        typingFocus,
        trailSource: ditherSourceRef.current,
        speechBubble: speechBubbleMounted
          ? {
              element: speechBubbleRef.current,
              placement: speechBubblePlacement,
              width: speechBubbleWidth,
              height: speechBubbleHeight,
              offset: speechBubbleOffset
            }
          : null
      });

      machineRef.current = machine;
      const unsubscribe = machine.subscribe((snapshot: MascotSnapshot) => {
        onStateChangeRef.current?.(snapshot);
      });

      machine.setDebugState(debugState);
      if (autoStart) machine.start();
      if (paused) machine.pause();

      return () => {
        unsubscribe();
        machine.destroy();
        if (machineRef.current === machine) machineRef.current = null;
      };
      // The serialized key intentionally rebuilds only when engine options change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [machineConfigKey]);

    useEffect(() => {
      machineRef.current?.setDebugState(debugState);
    }, [debugState]);

    useEffect(() => {
      machineRef.current?.setIdleVariant(idleVariant);
    }, [idleVariant]);

    useEffect(() => {
      machineRef.current?.setTypingFocus(typingFocus);
    }, [typingFocus?.x, typingFocus?.y]);

    useEffect(() => {
      if (paused) machineRef.current?.pause();
      else machineRef.current?.resume();
    }, [paused]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        start: () => machineRef.current?.start(),
        pause: () => machineRef.current?.pause(),
        resume: () => machineRef.current?.resume(),
        stop: () => machineRef.current?.settle(),
        playReaction: () => machineRef.current?.playReaction(),
        follow: (x, y) => machineRef.current?.follow(x, y),
        moveTo: (target, options) => machineRef.current?.moveTo(target, options),
        setState: (state, options) => machineRef.current?.setState(state, options),
        setDebugState: (state) => machineRef.current?.setDebugState(state),
        setIdleVariant: (variant) => machineRef.current?.setIdleVariant(variant),
        setTypingFocus: (target) => machineRef.current?.setTypingFocus(target),
        send: (event, payload) => machineRef.current?.send(event, payload),
        getSnapshot: () => machineRef.current?.getSnapshot() ?? null,
        getMachine: () => machineRef.current,
        getElement: () => svgRef.current
      }),
      []
    );

    const handleMascotPointer = (
      event: ReactPointerEvent<SVGSVGElement>,
      activatesReaction: boolean
    ) => {
      if (!svgRef.current || !machineRef.current) return;
      const target = event.target;
      const hitMascot =
        target instanceof Node && rootRef.current?.contains(target);
      const snapshot = machineRef.current.getSnapshot();

      if (
        reactionOnClick &&
        hitMascot &&
        snapshot.canReact
      ) {
        if (activatesReaction) machineRef.current.playReaction();
        return;
      }

      if (!interactive) return;
      const svg = svgRef.current;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(matrix.inverse());
      machineRef.current.follow(local.x, local.y);
    };

    const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
      onPointerMove?.(event);
      if (!event.defaultPrevented) handleMascotPointer(event, false);
    };

    const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
      onPointerDown?.(event);
      if (!event.defaultPrevented) handleMascotPointer(event, true);
    };

    return (
      <svg
        {...svgProps}
        ref={svgRef}
        viewBox="0 0 1200 600"
        role={role}
        aria-label={ariaLabel}
        data-seam-mascot=""
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        style={{
          display: "block",
          overflow: "visible",
          touchAction: interactive ? "none" : undefined,
          ...style
        }}
      >
        <defs aria-hidden="true">
          <path ref={starBodyRef} d={SOURCE_PATHS.star.body} />
          <path ref={starLeftEyeRef} d={SOURCE_PATHS.star.eyes[0]} />
          <path ref={starRightEyeRef} d={SOURCE_PATHS.star.eyes[1]} />
          <path ref={motionBodyRef} d={SOURCE_PATHS.motion.body} />
          <path ref={motionLeftEyeRef} d={SOURCE_PATHS.motion.eyes[0]} />
          <path ref={motionRightEyeRef} d={SOURCE_PATHS.motion.eyes[1]} />
          {speechBubbleMounted && <style>{SPEECH_BUBBLE_STYLES}</style>}
        </defs>
        {ditherTrail && (
          <foreignObject
            x="0"
            y="0"
            width="1200"
            height="600"
            data-seam-dither-trail=""
            aria-hidden="true"
            style={{ overflow: "hidden", pointerEvents: "none" }}
          >
            <DitherTrail
              sourceRef={ditherSourceRef}
              intensity={ditherTrailIntensity}
              scale={ditherTrailScale}
              color={ditherTrailColor ?? bodyColor}
            />
          </foreignObject>
        )}
        <g
          ref={rootRef}
          data-state="idle"
          data-reacting="false"
          data-idle-variant="rest"
          data-curious-gaze="center"
          data-ambient-pulsing="false"
        >
          <path
            ref={bodyRef}
            fill={bodyColor}
            stroke={bodyStrokeColor}
            strokeWidth={bodyStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            paintOrder="stroke fill"
            data-seam-mascot-hit=""
          />
          <path ref={leftEyeRef} fill={eyeColor} data-seam-mascot-hit="" />
          <path ref={rightEyeRef} fill={eyeColor} data-seam-mascot-hit="" />
        </g>
        {speechBubbleMounted && (
          <foreignObject
            ref={speechBubbleRef}
            x="0"
            y="0"
            width={speechBubbleWidth}
            height={speechBubbleHeight}
            data-seam-speech-bubble=""
            data-visible={speechBubbleVisible ? "true" : "false"}
            data-placement={
              speechBubblePlacement === "auto"
                ? "top"
                : speechBubblePlacement
            }
            aria-hidden={!speechBubbleVisible}
            aria-live="polite"
            style={{
              overflow: "visible",
              "--seam-speech-tail-size": `${speechBubbleTailSize}px`
            } as CSSProperties}
          >
            <div
              data-seam-speech-popover=""
              onPointerMove={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span
                data-seam-speech-tail=""
                aria-hidden="true"
                style={{
                  border: `1px solid ${speechBubbleBorder}`,
                  background: speechBubbleBackground
                }}
              />
              <div
                data-seam-speech-surface=""
                className={speechBubbleOptions?.className}
                style={{
                  border: `1px solid ${speechBubbleBorder}`,
                  borderRadius: speechBubbleRadius,
                  color: speechBubbleColor,
                  background: speechBubbleBackground,
                  ...speechBubbleOptions?.style
                }}
              >
                <div data-seam-speech-message="">{speechBubble}</div>
              </div>
            </div>
          </foreignObject>
        )}
      </svg>
    );
  }
);

SeamMascot.displayName = "SeamMascot";
