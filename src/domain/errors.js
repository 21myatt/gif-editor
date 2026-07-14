export const ErrorCode = Object.freeze({
  INVALID_FILE: 'INVALID_FILE',
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS',
  NO_FRAMES: 'NO_FRAMES',
  DECODE_FAILED: 'DECODE_FAILED',
  ENCODE_ABORTED: 'ENCODE_ABORTED',
  ENCODE_LIMIT_UNREACHABLE: 'ENCODE_LIMIT_UNREACHABLE',
  EXPORT_FAILED: 'EXPORT_FAILED'
});

export function appError(code, message, recovery = 'abort', cause = null) {
  return { code, message, recovery, cause };
}

export function normalizeError(error, fallbackCode = ErrorCode.EXPORT_FAILED) {
  if (error?.code && error?.message && error?.recovery) return error;
  return appError(fallbackCode, error?.message || 'An unexpected error occurred.', 'retry', error);
}
