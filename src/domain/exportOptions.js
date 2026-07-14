export const defaultFrameControls = Object.freeze({
  start: 0,
  end: 0
});

export function clampFrameRange(range, frameCount) {
  const last = Math.max(0, frameCount - 1);
  const start = clampInteger(range.start, 0, last);
  const end = clampInteger(range.end, start, last);
  return { start, end };
}

export function selectedFrameIndexes(range, frameCount) {
  const next = clampFrameRange(range, frameCount);
  return Array.from({ length: next.end - next.start + 1 }, (_, offset) => next.start + offset);
}

export function clampSpeed(value) {
  const speed = Number(value) || 1;
  return Math.min(4, Math.max(0.25, speed));
}

export function speedAdjustedDelay(delay, speed) {
  return Math.max(20, Math.round(delay / clampSpeed(speed)));
}

export function paletteQuality(mode, strategy) {
  if (mode === 'compact') return strategy.compactQuality;
  if (mode === 'balanced') return strategy.balancedQuality;
  return strategy.highQuality;
}

export function spriteLayout(frameCount, frameSize, columnsOrLayout) {
  const safeCount = Math.max(1, frameCount);
  const requestedColumns = typeof columnsOrLayout === 'object' ? columnsOrLayout.columns : columnsOrLayout;
  const requestedRows = typeof columnsOrLayout === 'object' ? columnsOrLayout.rows : null;
  const safeColumns = Math.max(1, Math.min(safeCount, Math.round(Number(requestedColumns) || Math.ceil(Math.sqrt(safeCount)))));
  const minimumRows = Math.ceil(safeCount / safeColumns);
  const rows = Math.max(minimumRows, Math.round(Number(requestedRows) || minimumRows));
  return {
    columns: safeColumns,
    rows,
    width: frameSize.width * safeColumns,
    height: frameSize.height * rows
  };
}

function clampInteger(value, min, max) {
  return Math.round(Math.min(max, Math.max(min, Number(value) || 0)));
}
