# Seam mascot icon

This directory contains the repository-ready icon exports for Seam's mascot.
The artwork uses the package's current idle SVG geometry without redrawing or
simplifying it.

| File | Purpose |
| --- | --- |
| `seam-mascot-icon.svg` | Editable, resolution-independent master (`1024 × 1024` viewBox) |
| `seam-mascot-icon-1024.png` | High-resolution application and marketplace icon |
| `seam-mascot-icon-512.png` | Standard repository, profile, and application icon |

The rounded square is `#050505`, the mascot is white, and the eyes match the
background. Pixels outside the rounded square are transparent.

Regenerate both PNG exports after changing the SVG master:

```bash
npm run build:icons
```

The exporter uses the repository's existing `playwright-core` dependency and a
local Chrome installation. Set `CHROME_PATH` if Chrome is not installed in a
standard location.

These are repository brand assets. They are intentionally excluded from the
runtime npm tarball so installing the React component does not copy artwork
exports into a consumer application.
