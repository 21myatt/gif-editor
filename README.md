# GIFor

GIFor is a browser-based GIF editor for cropping, resizing, optimizing,
previewing, and exporting GIFs or sprite sheets.

## About

Live app:

https://21myatt.github.io/gif-editor/

GIFor runs locally in the browser. GIF files are decoded, edited, previewed, and
exported on the client side.

## Features

- Crop GIFs with direct canvas handles and numeric controls.
- Preview transformed output before export.
- Resize output with a maximum edge setting.
- Flip horizontally or vertically.
- Set frame start and end range.
- Adjust playback/export speed from 0.25x to 4x.
- Choose palette mode: full color, balanced, or compact.
- Preserve alpha or export against a selected matte color.
- Export optimized GIFs under a target file size.
- Export selected frames as a PNG sprite sheet.
- Save and reopen `.gifor.json` project files.
- Use keyboard shortcuts for playback and frame seeking.

## Local Development

```bash
npm install
npm run dev
```

Then open the local Vite URL printed in the terminal.

## Verification

```bash
npm test
npm run build
npm run test:browser
npm run test:a11y
```

## GitHub Pages

This repository deploys to GitHub Pages with GitHub Actions.

The Pages build uses:

```bash
BASE_PATH=/gif-editor/ npm run build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, test commands, and transform
filter contribution notes.
