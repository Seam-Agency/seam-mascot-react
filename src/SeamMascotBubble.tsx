import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SmoothCorners } from "@lisse/react";
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

  [data-seam-mascot-bubble-action-anchor] {
    position: absolute;
    top: calc(100% + 7px);
    right: 0;
    z-index: 2;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-4px);
    transition: none;
    pointer-events: none;
  }

  [data-seam-mascot-bubble][data-placement="right"]
    [data-seam-mascot-bubble-action-anchor] {
    right: auto;
    left: 0;
  }

  [data-seam-mascot-bubble][data-placement="top"]
    [data-seam-mascot-bubble-action-anchor],
  [data-seam-mascot-bubble][data-placement="bottom"]
    [data-seam-mascot-bubble-action-anchor] {
    right: auto;
    left: 50%;
    transform: translate(-50%, -4px);
  }

  [data-seam-mascot-bubble][data-ready="true"][data-motion-state="open"]
    [data-seam-mascot-bubble-action-anchor] {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    transition:
      opacity 180ms var(--seam-bubble-ease) 70ms,
      transform 220ms var(--seam-bubble-ease) 70ms,
      visibility 0s linear 0s;
    pointer-events: auto;
  }

  [data-seam-mascot-bubble][data-ready="true"][data-motion-state="open"][data-placement="top"]
    [data-seam-mascot-bubble-action-anchor],
  [data-seam-mascot-bubble][data-ready="true"][data-motion-state="open"][data-placement="bottom"]
    [data-seam-mascot-bubble-action-anchor] {
    transform: translate(-50%, 0);
  }

  [data-seam-mascot-bubble][data-motion-state="closing"]
    [data-seam-mascot-bubble-action-anchor] {
    opacity: 0;
    visibility: hidden;
    transform: translateY(-2px);
    transition:
      opacity 110ms var(--seam-bubble-ease),
      transform 110ms var(--seam-bubble-ease),
      visibility 0s linear 110ms;
  }

  [data-seam-mascot-bubble-action] {
    display: inline-flex;
    min-width: 88px;
    height: 32px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 12px;
    border: 0;
    color: var(--seam-bubble-action-color);
    background: var(--seam-bubble-action-background);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 560;
    line-height: 1;
    transition:
      color 160ms var(--seam-bubble-ease),
      background 160ms var(--seam-bubble-ease),
      transform 120ms var(--seam-bubble-ease);
    pointer-events: auto;
  }

  [data-seam-mascot-bubble-action]:hover:not(:disabled) {
    background: var(--seam-bubble-action-hover);
  }

  [data-seam-mascot-bubble-action]:active:not(:disabled) {
    transform: translateY(1px);
  }

  [data-seam-mascot-bubble-action]:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 3px;
  }

  [data-seam-mascot-bubble-action]:disabled {
    cursor: wait;
    opacity: 0.48;
  }

  [data-seam-mascot-bubble-action-icon] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1em;
    height: 1em;
    transition: transform 160ms var(--seam-bubble-ease);
  }

  [data-seam-mascot-bubble-action-icon] > svg {
    width: 100%;
    height: 100%;
  }

  [data-seam-mascot-bubble-action]:hover:not(:disabled)
    [data-seam-mascot-bubble-action-icon] {
    transform: translateX(2px);
  }

  @media (prefers-reduced-motion: reduce) {
    [data-seam-mascot-bubble-surface],
    [data-seam-mascot-bubble-action-anchor],
    [data-seam-mascot-bubble-action],
    [data-seam-mascot-bubble-action-icon] {
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
  action,
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
    let lastFocusX = Number.NaN;
    let lastFocusY = Number.NaN;

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
          const focusDeltaX = nextLeft + width / 2 - anchor.x;
          const focusDeltaY = nextTop + height / 2 - anchor.y;
          const focusDistance = Math.hypot(focusDeltaX, focusDeltaY);

          if (visible && focusDistance > 1) {
            const focusX = focusDeltaX / focusDistance;
            const focusY = focusDeltaY / focusDistance;
            if (
              !Number.isFinite(lastFocusX) ||
              !Number.isFinite(lastFocusY) ||
              Math.abs(focusX - lastFocusX) > 0.015 ||
              Math.abs(focusY - lastFocusY) > 0.015
            ) {
              mascotRef.current?.setTypingFocus({ x: focusX, y: focusY });
              lastFocusX = focusX;
              lastFocusY = focusY;
            }
          }

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
    nudgeY,
    visible
  ]);

  const palette = theme === "dark"
    ? {
        background: "#f1f0ed",
        color: "#0a0a0b",
        border: "rgba(255, 255, 255, 0.72)",
        hover: "#ffffff"
      }
    : theme === "light"
      ? {
          background: "#0b0b0c",
          color: "#f4f3ee",
          border: "rgba(0, 0, 0, 0.72)",
          hover: "#19191b"
        }
      : {
          background: "light-dark(#0b0b0c, #f1f0ed)",
          color: "light-dark(#f4f3ee, #0a0a0b)",
          border: "light-dark(rgba(0, 0, 0, 0.72), rgba(255, 255, 255, 0.72))",
          hover: "light-dark(#19191b, #ffffff)"
        };

  const actionLabel = action?.label ?? "Continue";

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
        {action ? (
          <div data-seam-mascot-bubble-action-anchor="">
            <SmoothCorners
              as="button"
              type="button"
              corners={{ radius: 10, smoothing: 0.35 }}
              autoEffects={false}
              innerBorder={{
                width: 1,
                color: theme === "dark" ? "#000000" : "#ffffff",
                opacity: 0.12
              }}
              shadow={{
                offsetX: 0,
                offsetY: 7,
                blur: 18,
                spread: -3,
                color: "#000000",
                opacity: theme === "dark" ? 0.18 : 0.12
              }}
              shadowStrategy="box-shadow"
              data-seam-mascot-bubble-action=""
              aria-label={
                action.ariaLabel ??
                (typeof actionLabel === "string" ? actionLabel : undefined)
              }
              disabled={action.disabled}
              onClick={action.onClick}
              className={action.className}
              style={{
                "--seam-bubble-action-background": palette.background,
                "--seam-bubble-action-color": palette.color,
                "--seam-bubble-action-hover": palette.hover,
                ...action.style
              } as CSSProperties}
            >
              <span data-seam-mascot-bubble-action-label="">
                {actionLabel}
              </span>
              {action.icon ? (
                <span data-seam-mascot-bubble-action-icon="">
                  {action.icon}
                </span>
              ) : null}
            </SmoothCorners>
          </div>
        ) : null}
      </div>
    </>
  );
}
