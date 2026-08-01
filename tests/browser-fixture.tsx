import { createRoot } from "react-dom/client";
import { createElement, createRef, Fragment } from "react";
import type { RefObject } from "react";
import {
  SeamMascot,
  SeamMascotBubble,
  SeamMascotTypewriter
} from "../src/index.js";
import type { MascotSnapshot, SeamMascotHandle } from "../src/index.js";

declare global {
  interface Window {
    mascotSmoke: {
      ref: RefObject<SeamMascotHandle | null>;
      snapshots: MascotSnapshot[];
      typingCompletions: number;
    };
  }
}

const ref = createRef<SeamMascotHandle>();
const snapshots: MascotSnapshot[] = [];
const container = document.querySelector("#root");

if (!container) throw new Error("Browser smoke root is missing");

createRoot(container).render(
  createElement(
    Fragment,
    null,
    createElement(SeamMascot, {
      ref,
      interactive: true,
      bodyColor: "#ffffff",
      eyeColor: "#050505",
      ditherTrail: true,
      ditherTrailIntensity: 0,
      ditherTrailScale: 0.72,
      speechBubble: "Hello from Seam",
      speechBubbleOptions: {
        visible: true,
        placement: "auto",
        width: 220,
        height: 96,
        offset: 18
      },
      idleMotion: {
        blinkMinimumDelay: 180,
        blinkMaximumDelay: 280,
        blinkMinimumDuration: 130,
        blinkMaximumDuration: 180,
        doubleBlinkChance: 0.35,
        variantMinimumDelay: 120,
        variantMaximumDelay: 180,
        pulseMinimumDelay: 30000,
        pulseMaximumDelay: 30000
      },
      style: { width: "1200px", height: "600px", background: "#050505" },
      onStateChange: (snapshot) => snapshots.push(snapshot)
    }),
    createElement(
      SeamMascotBubble,
      {
        mascotRef: ref,
        visible: true,
        placement: "auto",
        theme: "dark",
        action: {
          label: "Continue",
          icon: createElement("span", { "data-custom-icon": "" }, "→")
        }
      },
      createElement(SeamMascotTypewriter, {
        text: "Crisp HTML guide messages can type at a calm readable pace.",
        speed: 26,
        startDelay: 180,
        punctuationDelay: 40,
        onComplete: () => {
          window.mascotSmoke.typingCompletions += 1;
        }
      })
    )
  )
);

window.mascotSmoke = { ref, snapshots, typingCompletions: 0 };
