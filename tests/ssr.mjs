import assert from "node:assert/strict";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Mascot,
  SeamMascot,
  SeamMascotBubble
} from "../dist/index.js";

assert.equal(Mascot, SeamMascot, "Mascot alias should reference SeamMascot");

const markup = renderToStaticMarkup(
  createElement(SeamMascot, {
    bodyColor: "#f7f7f4",
    bodyStrokeColor: "#151515",
    bodyStrokeWidth: 1.5,
    eyeColor: "#080808",
    "aria-label": "Test mascot"
  })
);

assert.match(markup, /^<svg/);
assert.match(markup, /data-seam-mascot=""/);
assert.match(markup, /aria-label="Test mascot"/);
assert.match(markup, /<defs/);
assert.match(markup, /fill="#f7f7f4"/);
assert.match(markup, /stroke="#151515"/);
assert.match(markup, /stroke-width="1.5"/);
assert.match(markup, /fill="#080808"/);
assert.match(markup, /data-idle-variant="rest"/);
assert.match(markup, /data-curious-gaze="center"/);
assert.match(markup, /data-ambient-pulsing="false"/);
assert.doesNotMatch(markup, /data-seam-dither-trail/);

const ditherMarkup = renderToStaticMarkup(
  createElement(SeamMascot, { ditherTrail: true })
);
assert.match(ditherMarkup, /data-seam-dither-trail=""/);
assert.match(ditherMarkup, /data-seam-dither-canvas=""/);

const speechMarkup = renderToStaticMarkup(
  createElement(SeamMascot, {
    speechBubble: createElement("strong", null, "Hello from Seam"),
    speechBubbleOptions: {
      visible: true,
      placement: "right",
      width: 220,
      height: 96
    }
  })
);
assert.match(speechMarkup, /data-seam-speech-bubble=""/);
assert.match(speechMarkup, /data-visible="true"/);
assert.match(speechMarkup, /data-placement="right"/);
assert.match(speechMarkup, /Hello from Seam/);

const htmlBubbleMarkup = renderToStaticMarkup(
  createElement(
    SeamMascotBubble,
    {
      mascotRef: createRef(),
      visible: true,
      placement: "right",
      theme: "dark"
    },
    "Crisp HTML guide"
  )
);
assert.match(htmlBubbleMarkup, /data-seam-mascot-bubble=""/);
assert.match(htmlBubbleMarkup, /data-seam-mascot-bubble-surface=""/);
assert.match(htmlBubbleMarkup, /data-visible="true"/);
assert.match(htmlBubbleMarkup, /data-motion-state="open"/);
assert.match(htmlBubbleMarkup, /Crisp HTML guide/);

console.log("SSR smoke test passed");
