export function createOptimizationAttempts(requestedEdge, strategy) {
  const edges = [...new Set([requestedEdge, ...strategy.edgeSteps]
    .map((edge) => Math.min(edge, requestedEdge, strategy.maximumEdge))
    .filter((edge) => edge >= strategy.minimumEdge))];

  return edges.flatMap((edge) => [
    {
      edge,
      sampleEvery: edge === requestedEdge ? 1 : 2,
      quality: edge === requestedEdge ? strategy.highQuality : strategy.balancedQuality
    },
    {
      edge,
      sampleEvery: edge >= 420 ? 2 : 3,
      quality: strategy.compactQuality
    }
  ]);
}

export function isWithinLimit(blob, maximumBytes) {
  return blob.size < maximumBytes;
}
