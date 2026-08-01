import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Mascot, SeamMascot } from "../dist/index.js";

assert.equal(Mascot, SeamMascot, "Mascot alias should reference SeamMascot");

const markup = renderToStaticMarkup(
  createElement(SeamMascot, {
    bodyColor: "#f7f7f4",
    eyeColor: "#080808",
    "aria-label": "Test mascot"
  })
);

assert.match(markup, /^<svg/);
assert.match(markup, /data-seam-mascot=""/);
assert.match(markup, /aria-label="Test mascot"/);
assert.match(markup, /<defs/);
assert.match(markup, /fill="#f7f7f4"/);
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

console.log("SSR smoke test passed");
