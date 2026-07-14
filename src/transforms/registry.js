const transforms = new Map();

export function registerTransform(transform) {
  validateTransform(transform);
  transforms.set(transform.id, transform);
  return transform;
}

export function getTransform(id) {
  return transforms.get(id) || null;
}

export function listTransforms() {
  return Array.from(transforms.values()).map(({ id, label, description }) => ({ id, label, description }));
}

export function applyTransforms(canvas, transformIds = []) {
  for (const id of transformIds) {
    const transform = getTransform(id);
    if (!transform) throw new Error(`Unknown transform: ${id}`);
    transform.apply(canvas);
  }
  return canvas;
}

function validateTransform(transform) {
  if (!transform || typeof transform !== 'object') throw new Error('Transform must be an object.');
  if (!transform.id || typeof transform.id !== 'string') throw new Error('Transform requires a string id.');
  if (!transform.label || typeof transform.label !== 'string') throw new Error('Transform requires a string label.');
  if (typeof transform.apply !== 'function') throw new Error('Transform requires an apply(canvas) function.');
}
