import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourcePath = path.join(
  packageDirectory,
  "assets",
  "icon",
  "seam-mascot-icon.svg"
);
const outputDirectory = path.dirname(sourcePath);
const outputSizes = [1024, 512];
const executableCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);
const executablePath = executableCandidates.find((candidate) =>
  fs.existsSync(candidate)
);

if (!executablePath) {
  throw new Error("Chrome was not found. Set the CHROME_PATH environment variable.");
}

const source = fs.readFileSync(sourcePath, "utf8");
const documentMarkup = `
  <style>
    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
  ${source}
`;

const browser = await chromium.launch({ executablePath, headless: true });

try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const size of outputSizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(documentMarkup);

    const outputPath = path.join(
      outputDirectory,
      `seam-mascot-icon-${size}.png`
    );

    await page.screenshot({ path: outputPath, omitBackground: true });
    console.log(`Generated ${path.relative(packageDirectory, outputPath)}`);
  }
} finally {
  await browser.close();
}
