import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
      ditherTrail = false,
      ditherTrailIntensity = 0,
      ditherTrailColor,
      bodyColor = "#ffffff",
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
      idleMotion
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
        trailSource: ditherSourceRef.current
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
          <path ref={bodyRef} fill={bodyColor} data-seam-mascot-hit="" />
          <path ref={leftEyeRef} fill={eyeColor} data-seam-mascot-hit="" />
          <path ref={rightEyeRef} fill={eyeColor} data-seam-mascot-hit="" />
        </g>
      </svg>
    );
  }
);

SeamMascot.displayName = "SeamMascot";
