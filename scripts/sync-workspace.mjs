import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, "..");
const defaultDemoDirectory = path.resolve(
  packageDirectory,
  "..",
  "..",
  "output",
  "socially-mascot-morph"
);
const demoDirectory = process.env.MASCOT_DEMO_DIR
  ? path.resolve(process.env.MASCOT_DEMO_DIR)
  : defaultDemoDirectory;
const enginePath = path.join(demoDirectory, "mascot-machine.js");
const htmlPath = path.join(demoDirectory, "index.html");
const outputDirectory = path.join(packageDirectory, "src", "core");

const normalizeLines = (value) => value.replace(/\r\n/g, "\n");

function convertEngine(sourceValue) {
  const prefix = '(function () {\n  "use strict";\n\n';
  const suffix = [
    "",
    "  MascotStateMachine.STATES = STATES;",
    "  MascotStateMachine.EVENTS = EVENTS;",
    "  window.MascotStateMachine = MascotStateMachine;",
    "})();",
    ""
  ].join("\n");
  let source = normalizeLines(sourceValue);

  if (!source.startsWith(prefix) || !source.endsWith(suffix)) {
    throw new Error(
      "Mascot engine wrapper changed; update scripts/sync-workspace.mjs."
    );
  }

  source = source.slice(prefix.length, -suffix.length);
  source = source
    .split("\n")
    .map((line) => line.startsWith("  ") ? line.slice(2) : line)
    .join("\n")
    .trimEnd();

  return [
    "// Generated from output/socially-mascot-morph/mascot-machine.js.",
    "// Run `npm run sync:workspace` after changing the demo engine.",
    "",
    source,
    "",
    "MascotStateMachine.STATES = STATES;",
    "MascotStateMachine.EVENTS = EVENTS;",
    "",
    "export { EVENTS, MascotStateMachine, STATES };",
    ""
  ].join("\n");
}

function extractPath(html, id) {
  const expression = new RegExp(`<path\\s+id=["']${id}["']\\s+d=["']([^"']+)["']\\s*\\/>`);
  const match = html.match(expression);
  if (!match) throw new Error(`SVG path not found: ${id}`);
  return match[1];
}

function createSourcesModule(htmlValue) {
  const html = normalizeLines(htmlValue);
  const sources = {
    star: {
      body: extractPath(html, "source-star-body"),
      eyes: [
        extractPath(html, "source-star-eye-left"),
        extractPath(html, "source-star-eye-right")
      ]
    },
    motion: {
      body: extractPath(html, "source-motion-body"),
      eyes: [
        extractPath(html, "source-motion-eye-left"),
        extractPath(html, "source-motion-eye-right")
      ]
    }
  };

  return [
    "// Generated from output/socially-mascot-morph/index.html.",
    "// Run `npm run sync:workspace` after changing the source SVG paths.",
    "",
    `export const SOURCE_PATHS = ${JSON.stringify(sources, null, 2)} as const;`,
    ""
  ].join("\n");
}

await mkdir(outputDirectory, { recursive: true });
const [engineSource, htmlSource] = await Promise.all([
  readFile(enginePath, "utf8"),
  readFile(htmlPath, "utf8")
]);
await Promise.all([
  writeFile(
    path.join(outputDirectory, "mascot-machine.js"),
    convertEngine(engineSource),
    "utf8"
  ),
  writeFile(
    path.join(outputDirectory, "source-paths.ts"),
    createSourcesModule(htmlSource),
    "utf8"
  )
]);

console.log(`Synced mascot engine and SVG paths from ${demoDirectory}`);
