import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { SeamMascotTypewriterProps } from "./types.js";

const DEFAULT_SPEED = 24;
const DEFAULT_START_DELAY = 120;
const DEFAULT_PUNCTUATION_DELAY = 90;

interface TypewriterFrame {
  text: string;
  visibleCharacters: number;
}

function getCharacterDelay(
  character: string,
  speed: number,
  punctuationDelay: number
): number {
  if (/\s/u.test(character)) return speed * 0.45;
  if (/[,.!?;:…]/u.test(character)) return speed + punctuationDelay;
  return speed;
}

export function SeamMascotTypewriter({
  text,
  active = true,
  revealAll = false,
  speed = DEFAULT_SPEED,
  startDelay = DEFAULT_START_DELAY,
  punctuationDelay = DEFAULT_PUNCTUATION_DELAY,
  cursor = "▌",
  onComplete,
  style,
  ...spanProps
}: SeamMascotTypewriterProps) {
  const characters = useMemo(() => Array.from(text), [text]);
  const initialFrame: TypewriterFrame = {
    text,
    visibleCharacters: revealAll ? characters.length : 0
  };
  const [frame, setFrame] = useState<TypewriterFrame>(initialFrame);
  const frameRef = useRef<TypewriterFrame>(initialFrame);
  const completedTextRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let timer = 0;
    let disposed = false;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const safeSpeed = Math.max(4, speed);
    const safeStartDelay = Math.max(0, startDelay);
    const safePunctuationDelay = Math.max(0, punctuationDelay);

    if (completedTextRef.current !== text) {
      completedTextRef.current = null;
    }

    const writeFrame = (nextFrame: TypewriterFrame) => {
      if (disposed) return;
      frameRef.current = nextFrame;
      setFrame(nextFrame);
    };

    const complete = () => {
      writeFrame({ text, visibleCharacters: characters.length });
      if (completedTextRef.current === text) return;
      completedTextRef.current = text;
      onCompleteRef.current?.();
    };

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      if (event.matches) complete();
    };

    if (!active) {
      if (frameRef.current.text !== text) {
        writeFrame({ text, visibleCharacters: 0 });
      }
      return;
    }

    if (revealAll || motionPreference.matches || characters.length === 0) {
      complete();
      return;
    }

    let visibleCharacters = frameRef.current.text === text
      ? Math.min(frameRef.current.visibleCharacters, characters.length)
      : 0;

    if (frameRef.current.text !== text) {
      writeFrame({ text, visibleCharacters: 0 });
    }

    if (visibleCharacters >= characters.length) {
      complete();
      return;
    }

    const typeNextCharacter = () => {
      visibleCharacters += 1;
      writeFrame({ text, visibleCharacters });

      if (visibleCharacters >= characters.length) {
        complete();
        return;
      }

      timer = window.setTimeout(
        typeNextCharacter,
        getCharacterDelay(
          characters[visibleCharacters - 1],
          safeSpeed,
          safePunctuationDelay
        )
      );
    };

    timer = window.setTimeout(
      typeNextCharacter,
      visibleCharacters === 0 ? safeStartDelay : safeSpeed
    );
    motionPreference.addEventListener("change", handleMotionPreference);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      motionPreference.removeEventListener("change", handleMotionPreference);
    };
  }, [
    active,
    characters,
    punctuationDelay,
    revealAll,
    speed,
    startDelay,
    text
  ]);

  const visibleCharacters = frame.text === text
    ? Math.min(frame.visibleCharacters, characters.length)
    : 0;
  const complete = visibleCharacters >= characters.length;
  const typingState = complete
    ? "complete"
    : visibleCharacters > 0
      ? "typing"
      : "waiting";
  const visibleText = characters.slice(0, visibleCharacters).join("");

  return (
    <span
      {...spanProps}
      data-seam-mascot-typewriter=""
      data-typing-state={typingState}
      data-visible-characters={visibleCharacters}
      aria-label={spanProps["aria-label"] ?? text}
      style={{
        position: "relative",
        display: "inline-grid",
        maxWidth: "100%",
        verticalAlign: "bottom",
        ...style
      } as CSSProperties}
    >
      <span
        data-seam-mascot-typewriter-sizer=""
        aria-hidden="true"
        style={{
          gridArea: "1 / 1",
          minWidth: 0,
          visibility: "hidden",
          whiteSpace: "pre-wrap"
        }}
      >
        {text}
      </span>
      <span
        data-seam-mascot-typewriter-output=""
        aria-hidden="true"
        style={{
          position: "relative",
          gridArea: "1 / 1",
          minWidth: 0,
          whiteSpace: "pre-wrap"
        }}
      >
        {visibleText}
        {!complete && visibleCharacters > 0 && cursor !== false ? (
          <span
            data-seam-mascot-typewriter-cursor=""
            style={{
              position: "absolute",
              marginLeft: "0.08em",
              lineHeight: 1,
              opacity: 0.68,
              pointerEvents: "none"
            }}
          >
            {cursor}
          </span>
        ) : null}
      </span>
    </span>
  );
}
