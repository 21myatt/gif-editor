export function outputSize(crop, maxEdge, strategy) {
  const edge = Math.min(maxEdge, strategy.maximumEdge);
  const scale = Math.min(1, edge / Math.max(crop.width, crop.height));
  return {
    width: Math.max(1, Math.round(crop.width * scale)),
    height: Math.max(1, Math.round(crop.height * scale))
  };
}
