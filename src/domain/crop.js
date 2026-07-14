export const DEFAULT_CROP = Object.freeze({ x: 0, y: 200, width: 720, height: 500 });

export function initialCrop(source) {
  if (source.width === 720 && source.height === 1280) return { ...DEFAULT_CROP };
  return { x: 0, y: 0, width: source.width, height: source.height };
}

export function constrainCrop(crop, source) {
  const x = clampInteger(crop.x, 0, Math.max(0, source.width - 1));
  const y = clampInteger(crop.y, 0, Math.max(0, source.height - 1));
  const width = Math.min(clampInteger(crop.width, 1, source.width), source.width - x);
  const height = Math.min(clampInteger(crop.height, 1, source.height), source.height - y);
  return { x, y, width, height };
}

export function cropFromGesture(original, handle, dx, dy, source, minimumSize = 24) {
  let left = original.x;
  let top = original.y;
  let right = original.x + original.width;
  let bottom = original.y + original.height;

  if (handle === 'move') {
    left = Math.min(source.width - original.width, Math.max(0, original.x + dx));
    top = Math.min(source.height - original.height, Math.max(0, original.y + dy));
    right = left + original.width;
    bottom = top + original.height;
  } else {
    if (handle.includes('w')) left = Math.min(right - minimumSize, Math.max(0, original.x + dx));
    if (handle.includes('e')) right = Math.max(left + minimumSize, Math.min(source.width, right + dx));
    if (handle.includes('n')) top = Math.min(bottom - minimumSize, Math.max(0, original.y + dy));
    if (handle.includes('s')) bottom = Math.max(top + minimumSize, Math.min(source.height, bottom + dy));
  }

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top)
  };
}

export function clampInteger(value, minimum, maximum) {
  return Math.round(Math.min(maximum, Math.max(minimum, Number(value) || 0)));
}
