import { applyTransforms } from '../transforms/index.js';

export const TRANSPARENT_KEY = 0xff00ff;

export function createCompositor(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }), index: -1, restore: null };
}

export function composeTo(compositor, frames, targetIndex) {
  if (targetIndex < compositor.index || targetIndex > compositor.index + 1) {
    compositor.ctx.clearRect(0, 0, compositor.canvas.width, compositor.canvas.height);
    compositor.index = -1;
    compositor.restore = null;
  }

  for (let index = compositor.index + 1; index <= targetIndex; index += 1) {
    if (index > 0) applyDisposal(frames[index - 1], compositor);
    const frame = frames[index];
    compositor.restore = getDisposal(frame) === 3
      ? compositor.ctx.getImageData(0, 0, compositor.canvas.width, compositor.canvas.height)
      : null;
    drawPatch(frame, compositor.ctx);
    compositor.index = index;
  }
  return compositor.canvas;
}

export function drawTransformed(ctx, sourceCanvas, transform, size) {
  ctx.save();
  ctx.translate(transform.flipX ? size.width : 0, transform.flipY ? size.height : 0);
  ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
  ctx.drawImage(
    sourceCanvas,
    transform.crop.x,
    transform.crop.y,
    transform.crop.width,
    transform.crop.height,
    0,
    0,
    size.width,
    size.height
  );
  ctx.restore();
  applyTransforms(ctx.canvas, transform.filters);
}

export function applyTransparencyKey(ctx, width, height, threshold) {
  const image = ctx.getImageData(0, 0, width, height);
  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] < threshold) {
      image.data[index] = 255;
      image.data[index + 1] = 0;
      image.data[index + 2] = 255;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function frameDelay(frame) {
  return Math.max(20, Number(frame.delay) || 100);
}

function drawPatch(frame, targetCtx) {
  const patch = document.createElement('canvas');
  patch.width = frame.dims.width;
  patch.height = frame.dims.height;
  patch.getContext('2d').putImageData(new ImageData(frame.patch, frame.dims.width, frame.dims.height), 0, 0);
  targetCtx.drawImage(patch, frame.dims.left, frame.dims.top);
}

function applyDisposal(frame, compositor) {
  const disposal = getDisposal(frame);
  if (disposal === 2) {
    compositor.ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
  } else if (disposal === 3 && compositor.restore) {
    compositor.ctx.putImageData(compositor.restore, 0, 0);
  }
  compositor.restore = null;
}

function getDisposal(frame) {
  return Number(frame.disposalType ?? frame.disposal ?? frame.gce?.disposalType ?? frame.gce?.extras?.disposal ?? 0);
}
