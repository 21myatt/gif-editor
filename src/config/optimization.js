export const defaultOptimizationStrategy = Object.freeze({
  maximumEdge: 512,
  minimumEdge: 1,
  edgeSteps: [512, 480, 420, 360, 300, 240, 128, 64, 32, 16, 8, 1],
  highQuality: 10,
  balancedQuality: 18,
  compactQuality: 24,
  transparentAlphaThreshold: 128,
  defaultLimitBytes: 1_000_000,
  minimumLimitMb: 0.25,
  maximumLimitMb: 5
});
