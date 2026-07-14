import { defaultOptimizationStrategy } from '../config/optimization.js';
import { selectedFrameIndexes, spriteLayout } from '../domain/exportOptions.js';
import { outputSize } from '../domain/output.js';
import { composeTo, createCompositor, drawTransformed } from './canvas.js';

export async function createSpriteSheet(context, layoutOptions = {}) {
  const size = outputSize(context.crop, context.outputEdge, defaultOptimizationStrategy);
  const indexes = selectedFrameIndexes(context.frameRange, context.frames.length);
  const layout = spriteLayout(indexes.length, size, layoutOptions);
  const compositor = createCompositor(context.source);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cell = document.createElement('canvas');
  cell.width = size.width;
  cell.height = size.height;
  const cellCtx = cell.getContext('2d', { willReadFrequently: true });

  indexes.forEach((frameIndex, spriteIndex) => {
    const source = composeTo(compositor, context.frames, frameIndex);
    cellCtx.clearRect(0, 0, size.width, size.height);
    drawTransformed(cellCtx, source, context, size);
    ctx.drawImage(
      cell,
      (spriteIndex % layout.columns) * size.width,
      Math.floor(spriteIndex / layout.columns) * size.height
    );
  });

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    width: layout.width,
    height: layout.height,
    frameWidth: size.width,
    frameHeight: size.height,
    columns: layout.columns,
    rows: layout.rows,
    frames: indexes.length
  };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export sprite sheet.'));
    }, 'image/png');
  });
}
