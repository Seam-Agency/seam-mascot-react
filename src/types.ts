import type { CSSProperties, PointerEventHandler, SVGProps } from "react";

export type MascotState =
  | "idle"
  | "launching"
  | "moving"
  | "settling"
  | "paused";

export type MascotDebugState = Exclude<MascotState, "paused"> | "auto";

export type MascotEvent =
  | "FOLLOW"
  | "MOVE_TO"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "STOP"
  | "IDLE"
  | "REACT"
  | "PAUSE"
  | "RESUME"
  | "TOGGLE_PAUSE";

export interface Point {
  x: number;
  y: number;
}

export interface MascotBounds {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
}

export interface MascotPhysicsOptions {
  stiffness?: number;
  damping?: number;
  maximumSpeed?: number;
  maximumAcceleration?: number;
  arrivalRadius?: number;
  stopSpeed?: number;
  headingResponse?: number;
  idleDrag?: number;
}

export interface MascotTailMotionOptions {
  minimumRate?: number;
  maximumRate?: number;
  response?: number;
}

export interface MascotTimingOptions {
  morphIn?: number;
  morphOut?: number;
  turn?: number;
  idleCycle?: number;
  breathCycle?: number;
  /** Click reaction duration in milliseconds. */
  reaction?: number;
  idleReveal?: number;
}

export interface MascotIdleMotionOptions {
  breathAmplitude?: number;
  baseAmplitude?: number;
  tipAmplitude?: number;
  rippleAmplitude?: number;
  /** Multiplier for independent idle spike pulse speed. */
  tipSpeed?: number;
}

export interface MascotSnapshot {
  readonly state: MascotState;
  readonly previousState: MascotState;
  readonly position: Readonly<Point>;
  readonly target: Readonly<Point>;
  readonly velocity: Readonly<Point>;
  readonly speed: number;
  readonly heading: number;
  readonly visualTilt: number;
  readonly facing: -1 | 1;
  readonly turning: boolean;
  readonly turnProgress: number;
  readonly pendingFacing: -1 | 0 | 1;
  readonly tailRate: number;
  readonly morph: number;
  readonly hasTarget: boolean;
  readonly reacting: boolean;
  readonly reactionProgress: number;
  readonly reactionAmount: number;
  readonly blinkAmount: number;
  readonly debugState: Exclude<MascotDebugState, "auto"> | null;
}

export interface MascotMoveTarget {
  x?: number;
  y?: number;
  progress?: number;
  progressX?: number;
  progressY?: number;
  unit?: "progress" | "svg";
}

export interface MascotMoveOptions {
  x?: number;
  y?: number;
  unit?: "progress" | "svg";
  static?: boolean;
}

export interface MascotMachine {
  start(): MascotMachine;
  destroy(): void;
  subscribe(listener: (snapshot: MascotSnapshot) => void): () => void;
  getSnapshot(): MascotSnapshot;
  send(event: MascotEvent, payload?: Record<string, unknown>): MascotMachine;
  setState(state: MascotState, options?: MascotMoveOptions): MascotMachine;
  setDebugState(state: MascotDebugState | null): MascotMachine;
  follow(x: number, y: number): MascotMachine;
  moveTo(
    target: number | MascotMoveTarget,
    options?: MascotMoveOptions
  ): MascotMachine;
  settle(): MascotMachine;
  playReaction(): MascotMachine;
  pause(): MascotMachine;
  resume(): MascotMachine;
}

export interface SeamMascotHandle {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  playReaction(): void;
  follow(x: number, y: number): void;
  moveTo(target: number | MascotMoveTarget, options?: MascotMoveOptions): void;
  setState(state: MascotState, options?: MascotMoveOptions): void;
  setDebugState(state: MascotDebugState | null): void;
  send(event: MascotEvent, payload?: Record<string, unknown>): void;
  getSnapshot(): MascotSnapshot | null;
  getMachine(): MascotMachine | null;
  getElement(): SVGSVGElement | null;
}

export interface SeamMascotProps
  extends Omit<SVGProps<SVGSVGElement>, "onStateChange" | "ref"> {
  /** Follow pointer movement inside the SVG. */
  interactive?: boolean;
  /** Start the requestAnimationFrame loop after mounting. */
  autoStart?: boolean;
  /** Controlled pause state. */
  paused?: boolean;
  /** Play the spike-and-blink reaction when the mascot is clicked. */
  reactionOnClick?: boolean;
  /** Lock the morph for visual debugging, or use `auto` for normal behavior. */
  debugState?: MascotDebugState;
  bodyColor?: string;
  eyeColor?: string;
  bounds?: Partial<MascotBounds>;
  initialPosition?: Point;
  targetHeight?: number;
  motionScale?: number;
  bodySamples?: number;
  eyeSamples?: number;
  physics?: MascotPhysicsOptions;
  tailMotion?: MascotTailMotionOptions;
  timing?: MascotTimingOptions;
  idleMotion?: MascotIdleMotionOptions;
  onStateChange?: (snapshot: MascotSnapshot) => void;
  onPointerMove?: PointerEventHandler<SVGSVGElement>;
  onPointerDown?: PointerEventHandler<SVGSVGElement>;
  style?: CSSProperties;
}
