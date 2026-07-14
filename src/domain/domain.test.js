import { describe, expect, it } from 'vitest';
import { defaultOptimizationStrategy } from '../config/optimization.js';
import { constrainCrop, cropFromGesture, initialCrop } from './crop.js';
import { clampFrameRange, paletteQuality, selectedFrameIndexes, speedAdjustedDelay, spriteLayout } from './exportOptions.js';
import { outputSize } from './output.js';
import { createOptimizationAttempts } from './optimization.js';

describe('crop domain', () => {
  it('keeps the legacy crop preset for 720 x 1280 GIFs', () => {
    expect(initialCrop({ width: 720, height: 1280 })).toEqual({ x: 0, y: 200, width: 720, height: 500 });
  });

  it('selects the full frame for other GIF dimensions', () => {
    expect(initialCrop({ width: 320, height: 240 })).toEqual({ x: 0, y: 0, width: 320, height: 240 });
  });

  it('keeps crops inside source bounds', () => {
    expect(constrainCrop({ x: 90, y: 70, width: 50, height: 50 }, { width: 100, height: 80 }))
      .toEqual({ x: 90, y: 70, width: 10, height: 10 });
  });

  it('moves a crop without crossing source bounds', () => {
    expect(cropFromGesture({ x: 10, y: 10, width: 40, height: 30 }, 'move', 100, 100, { width: 100, height: 80 }))
      .toEqual({ x: 60, y: 50, width: 40, height: 30 });
  });
});

describe('output domain', () => {
  it('limits the longest edge without upscaling', () => {
    expect(outputSize({ width: 720, height: 500 }, 512, defaultOptimizationStrategy)).toEqual({ width: 512, height: 356 });
    expect(outputSize({ width: 32, height: 16 }, 512, defaultOptimizationStrategy)).toEqual({ width: 32, height: 16 });
  });
});

describe('optimization domain', () => {
  it('starts at requested quality and ends with minimum edge attempts', () => {
    const attempts = createOptimizationAttempts(512, defaultOptimizationStrategy);
    expect(attempts[0]).toEqual({ edge: 512, sampleEvery: 1, quality: 10 });
    expect(attempts.at(-1).edge).toBe(1);
  });
});

describe('export options domain', () => {
  it('clamps frame ranges and returns selected frame indexes', () => {
    expect(clampFrameRange({ start: -2, end: 10 }, 5)).toEqual({ start: 0, end: 4 });
    expect(clampFrameRange({ start: 3, end: 1 }, 5)).toEqual({ start: 3, end: 3 });
    expect(selectedFrameIndexes({ start: 1, end: 3 }, 5)).toEqual([1, 2, 3]);
  });

  it('adjusts delay by playback speed without dropping below GIF-safe delay', () => {
    expect(speedAdjustedDelay(100, 2)).toBe(50);
    expect(speedAdjustedDelay(30, 4)).toBe(20);
    expect(speedAdjustedDelay(100, 0.5)).toBe(200);
  });

  it('maps palette modes to encoder quality values', () => {
    expect(paletteQuality('full', defaultOptimizationStrategy)).toBe(defaultOptimizationStrategy.highQuality);
    expect(paletteQuality('balanced', defaultOptimizationStrategy)).toBe(defaultOptimizationStrategy.balancedQuality);
    expect(paletteQuality('compact', defaultOptimizationStrategy)).toBe(defaultOptimizationStrategy.compactQuality);
  });

  it('calculates sprite sheet layout', () => {
    expect(spriteLayout(10, { width: 20, height: 12 }, 4)).toEqual({ columns: 4, rows: 3, width: 80, height: 36 });
    expect(spriteLayout(10, { width: 20, height: 12 }, { columns: 5, rows: 4 })).toEqual({ columns: 5, rows: 4, width: 100, height: 48 });
  });
});
