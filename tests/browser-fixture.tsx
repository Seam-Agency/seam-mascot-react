import { createRoot } from "react-dom/client";
import { createElement, createRef } from "react";
import type { RefObject } from "react";
import { SeamMascot } from "../src/index.js";
import type { MascotSnapshot, SeamMascotHandle } from "../src/index.js";

declare global {
  interface Window {
    mascotSmoke: {
      ref: RefObject<SeamMascotHandle | null>;
      snapshots: MascotSnapshot[];
    };
  }
}

const ref = createRef<SeamMascotHandle>();
const snapshots: MascotSnapshot[] = [];
const container = document.querySelector("#root");

if (!container) throw new Error("Browser smoke root is missing");

createRoot(container).render(
  createElement(SeamMascot, {
    ref,
    interactive: true,
    bodyColor: "#ffffff",
    eyeColor: "#050505",
    style: { width: "1200px", height: "600px", background: "#050505" },
    onStateChange: (snapshot) => snapshots.push(snapshot)
  })
);

window.mascotSmoke = { ref, snapshots };
