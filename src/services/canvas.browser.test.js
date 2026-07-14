import { describe, expect, it } from 'vitest';
import { applyTransparencyKey, composeTo, createCompositor, drawTransformed } from './canvas.js';
import { createProjectFile, parseProjectFile } from './projectFile.js';
import { createSpriteSheet } from './spriteSheet.js';
import { applyTransforms, getTransform, listTransforms } from '../transforms/index.js';

describe('canvas service browser integration', () => {
  it('composes frame patches with browser canvas APIs', () => {
    const compositor = createCompositor({ width: 2, height: 1 });
    const frames = [
      frame([255, 0, 0, 255, 0, 0, 255, 255], 2, 1, 0, 0),
      frame([0, 255, 0, 255], 1, 1, 1, 0)
    ];

    composeTo(compositor, frames, 1);

    expect(pixel(compositor.ctx, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(compositor.ctx, 1, 0)).toEqual([0, 255, 0, 255]);
  });

  it('draws cropped flipped output into a target canvas', () => {
    const source = document.createElement('canvas');
    source.width = 2;
    source.height = 1;
    const sourceCtx = source.getContext('2d');
    sourceCtx.putImageData(new ImageData(new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 255, 255
    ]), 2, 1), 0, 0);

    const target = document.createElement('canvas');
    target.width = 2;
    target.height = 1;
    const targetCtx = target.getContext('2d');

    drawTransformed(targetCtx, source, {
      crop: { x: 0, y: 0, width: 2, height: 1 },
      flipX: true,
      flipY: false
    }, { width: 2, height: 1 });

    expect(pixel(targetCtx, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(pixel(targetCtx, 1, 0)).toEqual([255, 0, 0, 255]);
  });

  it('replaces transparent pixels with the GIF transparency key color', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(new Uint8ClampedArray([
      1, 2, 3, 20,
      4, 5, 6, 255
    ]), 2, 1), 0, 0);

    applyTransparencyKey(ctx, 2, 1, 128);

    expect(pixel(ctx, 0, 0)).toEqual([255, 0, 255, 255]);
    expect(pixel(ctx, 1, 0)).toEqual([4, 5, 6, 255]);
  });

  it('exports selected frames as a PNG sprite sheet', async () => {
    const result = await createSpriteSheet({
      source: { width: 2, height: 1 },
      frames: [
        frame([255, 0, 0, 255, 0, 0, 255, 255], 2, 1, 0, 0),
        frame([0, 255, 0, 255], 1, 1, 1, 0)
      ],
      crop: { x: 0, y: 0, width: 2, height: 1 },
      outputEdge: 2,
      frameRange: { start: 0, end: 1 },
      flipX: false,
      flipY: false
    }, { columns: 2 });

    expect(result).toMatchObject({
      width: 4,
      height: 1,
      frameWidth: 2,
      frameHeight: 1,
      columns: 2,
      rows: 1,
      frames: 2
    });
    expect(result.blob.type).toBe('image/png');
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('round-trips a project file with embedded GIF source data', async () => {
    const sourceFile = new File([new Uint8Array([1, 2, 3])], 'sample.gif', { type: 'image/gif', lastModified: 123 });
    const project = await createProjectFile({
      file: sourceFile,
      crop: { x: 0, y: 0, width: 2, height: 1 },
      outputEdge: 2,
      maxBytes: 1_000_000,
      frameRange: { start: 0, end: 1 },
      speed: 1.5,
      paletteMode: 'balanced',
      alphaEnabled: false,
      matteColor: '#ffeecc',
      flipX: true,
      flipY: false,
      currentFrame: 1,
      zoom: 120
    });
    const projectFile = new File([JSON.stringify(project)], 'sample.gifor.json', { type: 'application/json' });
    const parsed = await parseProjectFile(projectFile);

    expect(parsed.sourceFile.name).toBe('sample.gif');
    expect(parsed.sourceFile.type).toBe('image/gif');
    expect(parsed.editor).toMatchObject({ speed: 1.5, paletteMode: 'balanced', alphaEnabled: false, matteColor: '#ffeecc', currentFrame: 1 });
    expect(Array.from(new Uint8Array(await parsed.sourceFile.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it('applies registered transforms through the transform registry', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1), 0, 0);

    expect(getTransform('grayscale')).toMatchObject({ id: 'grayscale', label: 'Grayscale' });
    expect(listTransforms().map((transform) => transform.id)).toContain('sepia');
    applyTransforms(canvas, ['grayscale']);

    const [red, green, blue] = pixel(ctx, 0, 0);
    expect(red).toBe(green);
    expect(green).toBe(blue);
  });
});

function frame(values, width, height, left, top, disposalType = 0) {
  return {
    patch: new Uint8ClampedArray(values),
    dims: { width, height, left, top },
    disposalType
  };
}

function pixel(ctx, x, y) {
  return Array.from(ctx.getImageData(x, y, 1, 1).data);
}
