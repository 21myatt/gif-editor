import GIF from 'gif.js.optimized';
import { ErrorCode, appError, normalizeError } from '../domain/errors.js';
import { paletteQuality, selectedFrameIndexes, speedAdjustedDelay } from '../domain/exportOptions.js';
import { createOptimizationAttempts, isWithinLimit } from '../domain/optimization.js';
import { outputSize } from '../domain/output.js';
import { applyTransparencyKey, composeTo, createCompositor, drawTransformed, frameDelay, TRANSPARENT_KEY } from './canvas.js';

export function createGifEncoder({ onProgress = () => {} } = {}) {
  return async function encodeUnderLimit({ context, strategy }) {
    const attempts = createOptimizationAttempts(context.outputEdge, strategy);
    let smallest = null;

    try {
      for (let index = 0; index < attempts.length; index += 1) {
        const attempt = attempts[index];
        const size = outputSize(context.crop, attempt.edge, strategy);
        const quality = Math.max(attempt.quality, paletteQuality(context.paletteMode, strategy));
        onProgress({
          title: 'Optimizing GIF',
          message: `Pass ${index + 1} of ${attempts.length} · ${size.width} × ${size.height}`,
          progress: 8 + (index / attempts.length) * 84
        });
        const blob = await encodeAttempt(context, strategy, { ...attempt, quality, ...size }, onProgress);
        if (!smallest || blob.size < smallest.blob.size) smallest = { blob, ...size };
        if (isWithinLimit(blob, context.maxBytes)) return { blob, ...size };
        await nextPaint();
      }

      throw appError(
        ErrorCode.ENCODE_LIMIT_UNREACHABLE,
        `Could not reach ${formatBytes(context.maxBytes)}. Smallest result was ${formatBytes(smallest.blob.size)}.`,
        'retry'
      );
    } catch (error) {
      throw normalizeError(error, ErrorCode.EXPORT_FAILED);
    }
  };
}

function encodeAttempt(context, strategy, options, onProgress) {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: Math.min(4, navigator.hardwareConcurrency || 2),
      quality: options.quality,
      width: options.width,
      height: options.height,
      transparent: TRANSPARENT_KEY,
      workerScript: '/gif.worker.js'
    });
    const compositor = createCompositor(context.source);
    const output = document.createElement('canvas');
    output.width = options.width;
    output.height = options.height;
    const ctx = output.getContext('2d', { willReadFrequently: true });

    const frameIndexes = selectedFrameIndexes(context.frameRange, context.frames.length);

    for (let index = 0; index < frameIndexes.length; index += options.sampleEvery) {
      const frameIndex = frameIndexes[index];
      const source = composeTo(compositor, context.frames, frameIndex);
      ctx.clearRect(0, 0, options.width, options.height);
      drawTransformed(ctx, source, context, options);
      applyTransparencyKey(ctx, options.width, options.height, strategy.transparentAlphaThreshold);
      let delay = 0;
      for (let offset = 0; offset < options.sampleEvery && index + offset < frameIndexes.length; offset += 1) {
        delay += speedAdjustedDelay(frameDelay(context.frames[frameIndexes[index + offset]]), context.speed);
      }
      gif.addFrame(ctx, { copy: true, delay });
      for (let skipped = index + 1; skipped < Math.min(index + options.sampleEvery, frameIndexes.length); skipped += 1) {
        composeTo(compositor, context.frames, frameIndexes[skipped]);
      }
    }

    gif.on('progress', (value) => onProgress({ progress: Math.round(10 + value * 85) }));
    gif.on('finished', resolve);
    gif.on('abort', () => reject(appError(ErrorCode.ENCODE_ABORTED, 'GIF encoding was interrupted.', 'retry')));
    try { gif.render(); } catch (error) { reject(error); }
  });
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function formatBytes(bytes) {
  return bytes < 1_000_000 ? `${(bytes / 1000).toFixed(bytes < 100_000 ? 1 : 0)} KB` : `${(bytes / 1_000_000).toFixed(2)} MB`;
}
