import { blurTransform } from './filters/blur.js';
import { grayscaleTransform } from './filters/grayscale.js';
import { sepiaTransform } from './filters/sepia.js';
import { registerTransform } from './registry.js';

registerTransform(grayscaleTransform);
registerTransform(sepiaTransform);
registerTransform(blurTransform);

export { applyTransforms, getTransform, listTransforms, registerTransform } from './registry.js';
