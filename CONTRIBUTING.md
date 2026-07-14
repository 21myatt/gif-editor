# Contributing to GIFor

Thanks for helping improve GIFor. The project is intentionally split into
small modules so new contributors can work on one behavior at a time.

## Local Setup

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm test
npm run build
npm run test:browser
npm run test:a11y
```

## Adding a Transform Filter

Filters use the transform registry in `src/transforms/registry.js`.

A transform module exports an object with this shape:

```js
export const myTransform = {
  id: 'my-filter',
  label: 'My Filter',
  description: 'Short description for UI/docs.',
  apply(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // mutate image.data
    ctx.putImageData(image, 0, 0);
  }
};
```

Then register it from `src/transforms/index.js`:

```js
import { myTransform } from './filters/myTransform.js';
import { registerTransform } from './registry.js';

registerTransform(myTransform);
```

Good examples:

- `src/transforms/filters/grayscale.js`
- `src/transforms/filters/sepia.js`
- `src/transforms/filters/blur.js`

Please add or update browser coverage in
`src/services/canvas.browser.test.js` when a filter depends on Canvas APIs.

## Accessibility

The CI workflow runs `npm run test:a11y`, which starts the Vite app and checks it
with axe-core in Chromium. If a change adds new visible UI, make sure the audit
passes and keyboard access still works.
