import type {
  CSSProperties,
  HTMLAttributes,
  MouseEventHandler,
  PointerEventHandler,
  ReactNode,
  RefObject,
  SVGProps
} from "react";

export type MascotState =
  | "idle"
  | "launching"
  | "moving"
  | "settling"
  | "paused";

export type MascotDebugState = Exclude<MascotState, "paused"> | "auto";

export type MascotIdleVariant =
  | "rest"
  | "typing"
  | "curious"
  | "bored"
  | "shy"
  | "surprised"
  | "squish"
  | "float"
  | "deep-breath";

export type MascotIdleVariantMode = MascotIdleVariant | "auto";

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
  /** Minimum random delay between idle blinks, in milliseconds. */
  blinkMinimumDelay?: number;
  /** Maximum random delay between idle blinks, in milliseconds. */
  blinkMaximumDelay?: number;
  /** Minimum blink duration, in milliseconds. */
  blinkMinimumDuration?: number;
  /** Maximum blink duration, in milliseconds. */
  blinkMaximumDuration?: number;
  /** Chance of a short second blink, from 0 to 1. */
  doubleBlinkChance?: number;
  /** Overall strength multiplier for ambient idle variants. */
  variantStrength?: number;
  /** Minimum delay between ambient idle variants, in milliseconds. */
  variantMinimumDelay?: number;
  /** Maximum delay between ambient idle variants, in milliseconds. */
  variantMaximumDelay?: number;
  /** Strength of the occasional click-like idle pulse. */
  pulseStrength?: number;
  /** Minimum random delay between ambient pulses, in milliseconds. */
  pulseMinimumDelay?: number;
  /** Maximum random delay between ambient pulses, in milliseconds. */
  pulseMaximumDelay?: number;
  /** Ambient pulse duration, in milliseconds. */
  pulseDuration?: number;
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
  readonly canReact: boolean;
  readonly reacting: boolean;
  readonly reactionProgress: number;
  readonly reactionAmount: number;
  readonly blinkAmount: number;
  readonly randomBlinking: boolean;
  readonly idleVariant: MascotIdleVariant;
  readonly idleVariantAmount: number;
  /** Normalized point the typing expression is reading toward. */
  readonly typingFocus: Readonly<Point>;
  /** Procedural curious gaze from -1 (left) to 1 (right). */
  readonly curiousGaze: number;
  readonly ambientPulsing: boolean;
  readonly ambientPulseAmount: number;
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

export type MascotSpeechBubblePlacement =
  | "auto"
  | "top"
  | "right"
  | "bottom"
  | "left";

export type MascotSpeechBubbleTheme = "auto" | "light" | "dark";

export interface MascotBubbleAction {
  /** Button content. Defaults to `Continue`. */
  label?: ReactNode;
  /** Optional icon node, including Nucleo React components. */
  icon?: ReactNode;
  /** Accessible label used when the visible label is not plain text. */
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
}

export interface SeamMascotTypewriterProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Plain text revealed by the typewriter. */
  text: string;
  /** Pause or resume typing without discarding current progress. */
  active?: boolean;
  /** Immediately reveal the complete text. */
  revealAll?: boolean;
  /** Base delay between characters, in milliseconds. */
  speed?: number;
  /** Delay before the first character, in milliseconds. */
  startDelay?: number;
  /** Additional pause after punctuation, in milliseconds. */
  punctuationDelay?: number;
  /** Cursor content. Pass `false` to hide it. */
  cursor?: ReactNode | false;
  /** Called once when the current text is fully visible. */
  onComplete?: () => void;
}

export interface MascotSpeechBubbleOptions {
  /** Keep the content mounted while opening and closing the bubble. */
  visible?: boolean;
  /** Preferred side of the mascot. Auto chooses the side with enough room. */
  placement?: MascotSpeechBubblePlacement;
  /** Bubble width in SVG viewBox units. */
  width?: number;
  /** Bubble height in SVG viewBox units. */
  height?: number;
  /** Gap between the mascot and the bubble. */
  offset?: number;
  /** Host theme. The bubble automatically uses the contrasting surface. */
  theme?: MascotSpeechBubbleTheme;
  /** Size of the speech-tail diamond in SVG viewBox units. */
  tailSize?: number;
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  borderRadius?: number;
  className?: string;
  style?: CSSProperties;
}

export interface MascotMachine {
  start(): MascotMachine;
  destroy(): void;
  subscribe(listener: (snapshot: MascotSnapshot) => void): () => void;
  getSnapshot(): MascotSnapshot;
  send(event: MascotEvent, payload?: Record<string, unknown>): MascotMachine;
  setState(state: MascotState, options?: MascotMoveOptions): MascotMachine;
  setDebugState(state: MascotDebugState | null): MascotMachine;
  setIdleVariant(variant: MascotIdleVariantMode): MascotMachine;
  setTypingFocus(target?: Partial<Point> | null): MascotMachine;
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
  setIdleVariant(variant: MascotIdleVariantMode): void;
  setTypingFocus(target?: Partial<Point> | null): void;
  send(event: MascotEvent, payload?: Record<string, unknown>): void;
  getSnapshot(): MascotSnapshot | null;
  getMachine(): MascotMachine | null;
  getElement(): SVGSVGElement | null;
}

export interface SeamMascotBubbleProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Ref of the mascot this HTML bubble should follow. */
  mascotRef: RefObject<SeamMascotHandle | null>;
  /** Keep the bubble mounted while controlling its open/close transition. */
  visible?: boolean;
  /** Preferred side. Auto favors the clearest horizontal side. */
  placement?: MascotSpeechBubblePlacement;
  /** Host theme. The bubble uses a contrasting surface. */
  theme?: MascotSpeechBubbleTheme;
  /** Gap after the mascot clearance, in CSS pixels. */
  offset?: number;
  /** Radius reserved around the mascot, in CSS pixels. */
  mascotClearance?: number;
  /** Minimum distance from the viewport edge, in CSS pixels. */
  edgePadding?: number;
  /** Fine horizontal adjustment in CSS pixels. */
  nudgeX?: number;
  /** Fine vertical adjustment in CSS pixels. */
  nudgeY?: number;
  /** Optional class for the crisp inner HTML surface. */
  surfaceClassName?: string;
  /** Optional style overrides for the crisp inner HTML surface. */
  surfaceStyle?: CSSProperties;
  /** Optional mascot-facing action. Its icon accepts any React node. */
  action?: MascotBubbleAction;
  children?: ReactNode;
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
  /** Randomize stationary ambient behavior, or lock a variant for debugging. */
  idleVariant?: MascotIdleVariantMode;
  /** Normalized direction the typing expression should read toward. */
  typingFocus?: Partial<Point>;
  /** Render the velocity trail from the moving form's rear tail edge. */
  ditherTrail?: boolean;
  /** Normalized dither density from 0 (subtle) to 1 (dense). */
  ditherTrailIntensity?: number;
  /** Trail footprint multiplier. Values below 1 make it shorter and thinner. */
  ditherTrailScale?: number;
  /** Dither pixel color. Defaults to the current bodyColor. */
  ditherTrailColor?: string;
  /** Optional speech content that follows the mascot. */
  speechBubble?: ReactNode;
  /** Layout and visual options for the speech bubble. */
  speechBubbleOptions?: MascotSpeechBubbleOptions;
  bodyColor?: string;
  /** Optional outline color for the morphing body path. */
  bodyStrokeColor?: string;
  /** Body outline width in SVG viewBox units. */
  bodyStrokeWidth?: number;
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
