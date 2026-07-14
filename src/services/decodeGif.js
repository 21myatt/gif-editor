import { parseGIF, decompressFrames } from 'gifuct-js';
import { ErrorCode, appError, normalizeError } from '../domain/errors.js';
import { initialCrop } from '../domain/crop.js';

export async function decodeGif({ file }) {
  if (!file || (!file.name.toLowerCase().endsWith('.gif') && file.type !== 'image/gif')) {
    throw appError(ErrorCode.INVALID_FILE, 'Choose a GIF file.', 'abort');
  }

  try {
    const parsed = parseGIF(await file.arrayBuffer());
    const source = getLogicalSize(parsed);
    if (!source.width || !source.height) {
      throw appError(ErrorCode.INVALID_DIMENSIONS, 'Could not read this GIF’s canvas dimensions.', 'abort');
    }

    const frames = decompressFrames(parsed, true);
    if (!frames.length) throw appError(ErrorCode.NO_FRAMES, 'No animation frames were found in this GIF.', 'abort');

    return { file, parsed, source, frames, crop: initialCrop(source) };
  } catch (error) {
    throw normalizeError(error, ErrorCode.DECODE_FAILED);
  }
}

function getLogicalSize(parsed) {
  const descriptor = parsed.lsd || parsed.logicalScreenDescriptor || {};
  return {
    width: Number(descriptor.width || descriptor.logicalScreenWidth || 0),
    height: Number(descriptor.height || descriptor.logicalScreenHeight || 0)
  };
}
