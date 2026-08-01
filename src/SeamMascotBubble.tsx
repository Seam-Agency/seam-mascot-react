import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { SeamMascotBubbleProps } from "./types.js";

const BUBBLE_STYLES = `
  [data-seam-mascot-bubble] {
    --seam-bubble-open-duration: 250ms;
    --seam-bubble-close-duration: 150ms;
    --seam-bubble-pre-scale: 0.97;
    --seam-bubble-close-scale: 0.99;
    --seam-bubble-ease: cubic-bezier(0.22, 1, 0.36, 1);
    position: fixed;
    top: 0;
    left: 0;
    z-index: 40;
    width: max-content;
    max-width: calc(100vw - 32px);
    pointer-events: none;
  }

  [data-seam-mascot-bubble-surface] {
    display: flex;
    align-items: center;
    min-height: 44px;
    max-width: min(320px, calc(100vw - 32px));
    padding: 10px 14px;
    box-sizing: border-box;
    border: 1px solid var(--seam-bubble-border);
    border-radius: var(--seam-bubble-radius, 16px);
    color: var(--seam-bubble-color);
    background: var(--seam-bubble-background);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
    opacity: 0;
    visibility: hidden;
    transform:
      translate(
        var(--seam-bubble-enter-x, 0),
        var(--seam-bubble-enter-y, 8px)
      )
      scale(var(--seam-bubble-pre-scale));
    transition: none;
    will-change: transform, opacity;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    font-weight: 540;
    line-height: 1.35;
    letter-spacing: -0.012em;
    -webkit-font-smoothing: antialiased;
  }

  [data-seam-mascot-bubble][data-placement="right"]
    [data-seam-mascot-bubble-surface] {
    transform-origin: bottom left;
  }

  [data-seam-mascot-bubble][data-placement="left"]
    [data-seam-mascot-bubble-surface] {
    transform-origin: bottom right;
  }

  [data-seam-mascot-bubble][data-placement="top"]
    [data-seam-mascot-bubble-surface] {
    transform-origin: bottom center;
  }

  [data-seam-mascot-bubble][data-placement="bottom"]
    [data-seam-mascot-bubble-surface] {
    transform-origin: top center;
  }

  [data-seam-mascot-bubble][data-ready="true"][data-motion-state="open"]
    [data-seam-mascot-bubble-surface] {
    opacity: 1;
    visibility: visible;
    transform: translate(0, 0) scale(1);
    transition:
      opacity var(--seam-bubble-open-duration) var(--seam-bubble-ease),
      transform var(--seam-bubble-open-duration) var(--seam-bubble-ease),
      visibility 0s linear 0s;
    pointer-events: auto;
  }

  [data-seam-mascot-bubble][data-ready="true"][data-motion-state="closing"]
    [data-seam-mascot-bubble-surface] {
    opacity: 0;
    visibility: hidden;
    transform:
      translate(
        var(--seam-bubble-enter-x, 0),
        var(--seam-bubble-enter-y, 8px)
      )
      scale(var(--seam-bubble-close-scale));
    transition:
      opacity var(--seam-bubble-close-duration) var(--seam-bubble-ease),
      transform var(--seam-bubble-close-duration) var(--seam-bubble-ease),
      visibility 0s linear var(--seam-bubble-close-duration);
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    [data-seam-mascot-bubble-surface] {
      transition: none !important;
    }
  }
`;

type ResolvedPlacement = Exclude<
  SeamMascotBubbleProps["placement"],
  "auto" | undefined
>;

interface CandidatePosition {
  placement: ResolvedPlacement;
  left: number;
  top: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function overflowScore(
  candidate: CandidatePosition,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  padding: number
): number {
  return (
    Math.max(0, padding - candidate.left) +
    Math.max(0, candidate.left + width - viewportWidth + padding) +
    Math.max(0, padding - candidate.top) +
    Math.max(0, candidate.top + height - viewportHeight + padding)
  );
}

function roundToDevicePixel(value: number): number {
  const ratio = window.devicePixelRatio || 1;
  return Math.round(value * ratio) / ratio;
}

function cssDurationToMilliseconds(value: string, fallback: number): number {
  const normalized = value.trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return normalized.endsWith("ms") ? parsed : parsed * 1000;
}

export function SeamMascotBubble({
  mascotRef,
  visible = true,
  placement = "auto",
  theme = "auto",
  offset = 12,
  mascotClearance = 34,
  edgePadding = 16,
  nudgeX = 0,
  nudgeY = 0,
  surfaceClassName,
  surfaceStyle,
  children,
  className,
  style,
  ...divProps
}: SeamMascotBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const [motionState, setMotionState] = useState<
    "closed" | "open" | "closing"
  >(visible ? "open" : "closed");

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (visible) {
      setMotionState("open");
      return;
    }

    setMotionState("closing");
    const bubble = bubbleRef.current;
    const closeDuration = bubble
      ? cssDurationToMilliseconds(
          window.getComputedStyle(bubble).getPropertyValue(
            "--seam-bubble-close-duration"
          ),
          150
        )
      : 150;
    const timer = window.setTimeout(
      () => setMotionState("closed"),
      closeDuration
    );
    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;

    let frame = 0;
    let lastLeft = Number.NaN;
    let lastTop = Number.NaN;
    let lastPlacement = "";

    bubble.dataset.ready = "false";

    const update = () => {
      const svg = mascotRef.current?.getElement();
      const snapshot = mascotRef.current?.getSnapshot();
      const matrix = svg?.getScreenCTM();

      if (svg && snapshot && matrix) {
        const point = svg.createSVGPoint();
        point.x = snapshot.position.x;
        point.y = snapshot.position.y;
        const anchor = point.matrixTransform(matrix);
        const width = bubble.offsetWidth;
        const height = bubble.offsetHeight;

        if (width > 0 && height > 0) {
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const distance = Math.max(0, mascotClearance) + Math.max(0, offset);
          const candidates: Record<ResolvedPlacement, CandidatePosition> = {
            right: {
              placement: "right",
              left: anchor.x + distance,
              top: anchor.y - height / 2
            },
            left: {
              placement: "left",
              left: anchor.x - distance - width,
              top: anchor.y - height / 2
            },
            top: {
              placement: "top",
              left: anchor.x - width / 2,
              top: anchor.y - distance - height
            },
            bottom: {
              placement: "bottom",
              left: anchor.x - width / 2,
              top: anchor.y + distance
            }
          };

          let selected: CandidatePosition;

          if (placement === "auto") {
            const horizontalPreference: ResolvedPlacement =
              anchor.x < viewportWidth * 0.58 ? "right" : "left";
            const opposite: ResolvedPlacement =
              horizontalPreference === "right" ? "left" : "right";
            const order: ResolvedPlacement[] = [
              horizontalPreference,
              opposite,
              "top",
              "bottom"
            ];

            selected = order
              .map((side, index) => ({
                candidate: candidates[side],
                score:
                  overflowScore(
                    candidates[side],
                    width,
                    height,
                    viewportWidth,
                    viewportHeight,
                    edgePadding
                  ) + index * 0.001
              }))
              .sort((a, b) => a.score - b.score)[0].candidate;
          } else {
            selected = candidates[placement];
          }

          const maximumLeft = Math.max(edgePadding, viewportWidth - width - edgePadding);
          const maximumTop = Math.max(edgePadding, viewportHeight - height - edgePadding);
          const nextLeft = roundToDevicePixel(
            clamp(selected.left + nudgeX, edgePadding, maximumLeft)
          );
          const nextTop = roundToDevicePixel(
            clamp(selected.top + nudgeY, edgePadding, maximumTop)
          );

          if (nextLeft !== lastLeft) {
            bubble.style.left = `${nextLeft}px`;
            lastLeft = nextLeft;
          }
          if (nextTop !== lastTop) {
            bubble.style.top = `${nextTop}px`;
            lastTop = nextTop;
          }
          if (selected.placement !== lastPlacement) {
            bubble.dataset.placement = selected.placement;
            const entryOffset: Record<ResolvedPlacement, [string, string]> = {
              right: ["-8px", "8px"],
              left: ["8px", "8px"],
              top: ["0", "8px"],
              bottom: ["0", "-8px"]
            };
            bubble.style.setProperty(
              "--seam-bubble-enter-x",
              entryOffset[selected.placement][0]
            );
            bubble.style.setProperty(
              "--seam-bubble-enter-y",
              entryOffset[selected.placement][1]
            );
            lastPlacement = selected.placement;
          }

          bubble.dataset.ready = "true";
        }
      }

      frame = window.requestAnimationFrame(update);
    };

    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [
    mascotRef,
    placement,
    offset,
    mascotClearance,
    edgePadding,
    nudgeX,
    nudgeY
  ]);

  const palette = theme === "dark"
    ? {
        background: "#f1f0ed",
        color: "#0a0a0b",
        border: "rgba(255, 255, 255, 0.72)"
      }
    : theme === "light"
      ? {
          background: "#0b0b0c",
          color: "#f4f3ee",
          border: "rgba(0, 0, 0, 0.72)"
        }
      : {
          background: "light-dark(#0b0b0c, #f1f0ed)",
          color: "light-dark(#f4f3ee, #0a0a0b)",
          border: "light-dark(rgba(0, 0, 0, 0.72), rgba(255, 255, 255, 0.72))"
        };

  return (
    <>
      <style>{BUBBLE_STYLES}</style>
      <div
        {...divProps}
        ref={bubbleRef}
        className={className}
        data-seam-mascot-bubble=""
        data-visible={visible ? "true" : "false"}
        data-motion-state={motionState}
        data-ready="false"
        data-placement={placement === "auto" ? "right" : placement}
        data-theme={theme}
        aria-hidden={!visible}
        inert={!visible ? true : undefined}
        style={style}
      >
        <div
          data-seam-mascot-bubble-surface=""
          className={surfaceClassName}
          style={{
            "--seam-bubble-background": palette.background,
            "--seam-bubble-color": palette.color,
            "--seam-bubble-border": palette.border,
            ...surfaceStyle
          } as CSSProperties}
        >
          {children}
        </div>
      </div>
    </>
  );
}
