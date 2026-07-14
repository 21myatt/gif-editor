import { assign, fromCallback, fromPromise, setup } from 'xstate';
import { defaultOptimizationStrategy } from '../config/optimization.js';
import { clampInteger, constrainCrop, initialCrop } from '../domain/crop.js';
import { ErrorCode, normalizeError } from '../domain/errors.js';
import { clampFrameRange, clampSpeed, speedAdjustedDelay } from '../domain/exportOptions.js';
import { frameDelay } from '../services/canvas.js';
import { decodeGif as decodeGifService } from '../services/decodeGif.js';

const DEFAULT_MATTE_COLOR = '#ffffff';
const DEBUG_FRAME_SUMMARY_LIMIT = 120;
const DEBUG_FILTER_SUMMARY_LIMIT = 50;
const SMART_TIMELINE_FRAME_THRESHOLD = 80;

export function createEditorMachine({ encodeGif, decodeGif = decodeGifService }) {
  return setup({
    actors: {
      decodeGif: fromPromise(({ input }) => decodeGif(input)),
      encodeGif: fromPromise(({ input }) => encodeGif(input)),
      playbackTimer: fromCallback(({ input, sendBack }) => {
        const timer = setTimeout(() => sendBack({ type: 'TICK' }), input.delay);
        return () => clearTimeout(timer);
      })
    },
    guards: {
      hasFrames: ({ context }) => context.frames.length > 0,
      returnsToEditing: ({ context }) => context.error?.returnState === 'editing'
    },
    actions: {
      assignDecodedGif: assign(({ event }) => ({
        ...event.output,
        outputEdge: defaultOptimizationStrategy.maximumEdge,
        frameRange: { start: 0, end: Math.max(0, event.output.frames.length - 1) },
        speed: 1,
        paletteMode: 'full',
        alphaEnabled: true,
        matteColor: DEFAULT_MATTE_COLOR,
        timelineMode: event.output.frames.length > SMART_TIMELINE_FRAME_THRESHOLD ? 'sampled' : 'all',
        currentFrame: 0,
        error: null
      })),
      assignLoadError: assign(({ event }) => ({
        error: { ...normalizeError(event.error, ErrorCode.DECODE_FAILED), returnState: 'empty' }
      })),
      assignExportError: assign(({ event }) => ({
        error: { ...normalizeError(event.error, ErrorCode.EXPORT_FAILED), returnState: 'editing' }
      })),
      assignExportResult: assign(({ event }) => ({ exportResult: event.output, error: null })),
      clearDocument: assign(() => initialContext()),
      clearError: assign({ error: null }),
      noop: () => {},
      applyProjectState: assign(({ context, event }) => ({
        crop: constrainCrop(event.project.crop || context.crop, context.source),
        outputEdge: clampInteger(event.project.outputEdge, defaultOptimizationStrategy.minimumEdge, defaultOptimizationStrategy.maximumEdge),
        maxBytes: Math.round(Math.min(defaultOptimizationStrategy.maximumLimitMb, Math.max(defaultOptimizationStrategy.minimumLimitMb, Number(event.project.maxBytes) / 1_000_000 || 1)) * 1_000_000),
        frameRange: clampFrameRange(event.project.frameRange || context.frameRange, context.frames.length),
        speed: clampSpeed(event.project.speed),
        paletteMode: ['full', 'balanced', 'compact'].includes(event.project.paletteMode) ? event.project.paletteMode : 'full',
        alphaEnabled: event.project.alphaEnabled !== false,
        matteColor: normalizeHexColor(event.project.matteColor, DEFAULT_MATTE_COLOR),
        timelineMode: event.project.timelineMode === 'sampled' ? 'sampled' : 'all',
        filters: Array.isArray(event.project.filters) ? event.project.filters : [],
        flipX: Boolean(event.project.flipX),
        flipY: Boolean(event.project.flipY),
        currentFrame: Math.max(0, Math.min(context.frames.length - 1, Number(event.project.currentFrame) || 0)),
        zoom: Math.min(150, Math.max(50, Number(event.project.zoom) || 100))
      })),
      updateCrop: assign(({ context, event }) => ({ crop: constrainCrop(event.crop, context.source) })),
      resetCrop: assign(({ context }) => ({ crop: initialCrop(context.source) })),
      updateOutputEdge: assign(({ event }) => ({
        outputEdge: clampInteger(event.value, defaultOptimizationStrategy.minimumEdge, defaultOptimizationStrategy.maximumEdge)
      })),
      toggleFlipX: assign(({ context }) => ({ flipX: !context.flipX })),
      toggleFlipY: assign(({ context }) => ({ flipY: !context.flipY })),
      updateLimit: assign(({ event }) => ({
        maxBytes: Math.round(Math.min(defaultOptimizationStrategy.maximumLimitMb, Math.max(defaultOptimizationStrategy.minimumLimitMb, Number(event.value) || 1)) * 1_000_000)
      })),
      updateFrameStart: assign(({ context, event }) => ({
        frameRange: clampFrameRange({ ...context.frameRange, start: event.value }, context.frames.length)
      })),
      updateFrameEnd: assign(({ context, event }) => ({
        frameRange: clampFrameRange({ ...context.frameRange, end: event.value }, context.frames.length)
      })),
      updateSpeed: assign(({ event }) => ({ speed: clampSpeed(event.value) })),
      updatePaletteMode: assign(({ event }) => ({
        paletteMode: ['full', 'balanced', 'compact'].includes(event.value) ? event.value : 'full'
      })),
      updateAlpha: assign(({ event }) => ({ alphaEnabled: Boolean(event.value) })),
      updateMatteColor: assign(({ event, context }) => ({
        matteColor: normalizeHexColor(event.value, context.matteColor)
      })),
      toggleTimelineMode: assign(({ context }) => ({ timelineMode: context.timelineMode === 'all' ? 'sampled' : 'all' })),
      updateZoom: assign(({ event }) => ({ zoom: Math.min(150, Math.max(50, event.value)) })),
      seekFrame: assign(({ context, event }) => ({
        currentFrame: Math.max(0, Math.min(context.frames.length - 1, event.index))
      })),
      advanceFrame: assign(({ context }) => ({
        currentFrame: (context.currentFrame + 1) % context.frames.length
      }))
    }
  }).createMachine({
    id: 'editor',
    initial: 'empty',
    context: initialContext,
    states: {
      empty: {
        on: { OPEN_GIF: { target: 'loading', actions: assign(({ event }) => ({ pendingFile: event.file, error: null })) } }
      },
      loading: {
        invoke: {
          src: 'decodeGif',
          input: ({ context }) => ({ file: context.pendingFile }),
          onDone: { target: 'buildingTimeline', actions: 'assignDecodedGif' },
          onError: { target: 'error', actions: 'assignLoadError' }
        }
      },
      buildingTimeline: {
        on: {
          TIMELINE_READY: 'editing',
          TIMELINE_FAILED: { target: 'error', actions: 'assignLoadError' }
        }
      },
      editing: {
        type: 'parallel',
        on: {
          UPDATE_CROP: { actions: 'updateCrop' },
          RESET_CROP: { actions: 'resetCrop' },
          SET_OUTPUT_EDGE: { actions: 'updateOutputEdge' },
          TOGGLE_FLIP_X: { actions: 'toggleFlipX' },
          TOGGLE_FLIP_Y: { actions: 'toggleFlipY' },
          SET_LIMIT: { actions: 'updateLimit' },
          SET_FRAME_START: { actions: 'updateFrameStart' },
          SET_FRAME_END: { actions: 'updateFrameEnd' },
          SET_SPEED: { actions: 'updateSpeed' },
          SET_PALETTE_MODE: { actions: 'updatePaletteMode' },
          SET_ALPHA: { actions: 'updateAlpha' },
          SET_MATTE_COLOR: { actions: 'updateMatteColor' },
          TOGGLE_TIMELINE_MODE: { actions: 'toggleTimelineMode' },
          SET_ZOOM: { actions: 'updateZoom' },
          SEEK: { actions: 'seekFrame' },
          APPLY_PROJECT_STATE: { actions: 'applyProjectState' },
          EXPORT_SPRITE_SHEET: { actions: 'noop' },
          EXPORT: { target: 'exporting', guard: 'hasFrames' },
          NEW: { target: 'empty', actions: 'clearDocument' }
        },
        states: {
          tool: {
            initial: 'crop',
            states: {
              crop: { on: { SHOW_PREVIEW: 'preview' } },
              preview: { on: { SHOW_CROP: 'crop' } }
            }
          },
          transport: {
            initial: 'paused',
            states: {
              paused: { on: { PLAY: 'playing' } },
              playing: {
                invoke: {
                  src: 'playbackTimer',
                  input: ({ context }) => ({ delay: speedAdjustedDelay(frameDelay(context.frames[context.currentFrame]), context.speed) })
                },
                on: {
                  PAUSE: 'paused',
                  SEEK: { target: 'paused', actions: 'seekFrame' },
                  TICK: { target: 'playing', reenter: true, actions: 'advanceFrame' }
                }
              }
            }
          }
        }
      },
      exporting: {
        invoke: {
          src: 'encodeGif',
          input: ({ context }) => ({ context, strategy: defaultOptimizationStrategy }),
          onDone: { target: 'editing', actions: 'assignExportResult' },
          onError: { target: 'error', actions: 'assignExportError' }
        }
      },
      error: {
        on: {
          RETRY: [
            { target: 'exporting', guard: 'returnsToEditing', actions: 'clearError' },
            { target: 'loading', actions: 'clearError' }
          ],
          ABORT: [
            { target: 'editing', guard: 'returnsToEditing', actions: 'clearError' },
            { target: 'empty', actions: ['clearDocument'] }
          ]
        }
      }
    }
  });
}

export function serializeEditorContext(context) {
  return {
    pendingFile: serializeFile(context.pendingFile),
    file: serializeFile(context.file),
    parsed: summarizeParsedGif(context.parsed),
    source: context.source,
    frames: context.frames.slice(0, DEBUG_FRAME_SUMMARY_LIMIT).map(summarizeFrame),
    crop: context.crop,
    outputEdge: context.outputEdge,
    maxBytes: context.maxBytes,
    frameRange: context.frameRange,
    speed: context.speed,
    paletteMode: context.paletteMode,
    alphaEnabled: context.alphaEnabled,
    matteColor: context.matteColor,
    timelineMode: context.timelineMode,
    frameSummary: {
      total: context.frames.length,
      serialized: Math.min(context.frames.length, DEBUG_FRAME_SUMMARY_LIMIT),
      truncated: context.frames.length > DEBUG_FRAME_SUMMARY_LIMIT
    },
    filters: summarizeFilters(context.filters),
    flipX: context.flipX,
    flipY: context.flipY,
    currentFrame: context.currentFrame,
    zoom: context.zoom,
    exportResult: context.exportResult ? {
      width: context.exportResult.width,
      height: context.exportResult.height,
      blob: serializeBlob(context.exportResult.blob)
    } : null,
    error: serializeError(context.error)
  };
}

export function serializeEditorSnapshot(snapshot) {
  return {
    value: snapshot.value,
    status: snapshot.status,
    context: serializeEditorContext(snapshot.context)
  };
}

export function initialContext() {
  return {
    pendingFile: null,
    file: null,
    parsed: null,
    frames: [],
    source: { width: 720, height: 1280 },
    crop: { x: 0, y: 200, width: 720, height: 500 },
    outputEdge: defaultOptimizationStrategy.maximumEdge,
    maxBytes: defaultOptimizationStrategy.defaultLimitBytes,
    frameRange: { start: 0, end: 0 },
    speed: 1,
    paletteMode: 'full',
    alphaEnabled: true,
    matteColor: DEFAULT_MATTE_COLOR,
    timelineMode: 'all',
    filters: [],
    flipX: false,
    flipY: false,
    currentFrame: 0,
    zoom: 100,
    exportResult: null,
    error: null
  };
}

function serializeFile(file) {
  if (!file) return null;
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified
  };
}

function serializeBlob(blob) {
  if (!blob) return null;
  return {
    size: blob.size,
    type: blob.type
  };
}

function summarizeParsedGif(parsed) {
  if (!parsed) return null;
  const descriptor = parsed.lsd || parsed.logicalScreenDescriptor || {};
  return {
    width: Number(descriptor.width || descriptor.logicalScreenWidth || 0),
    height: Number(descriptor.height || descriptor.logicalScreenHeight || 0),
    frames: Array.isArray(parsed.frames) ? parsed.frames.length : undefined
  };
}

function summarizeFilters(filters) {
  if (!Array.isArray(filters)) return [];
  return filters
    .slice(0, DEBUG_FILTER_SUMMARY_LIMIT)
    .map((filter) => typeof filter === 'string' ? filter : {
      id: filter?.id,
      label: filter?.label,
      type: typeof filter
    });
}

function summarizeFrame(frame) {
  return {
    delay: frame.delay,
    disposalType: frame.disposalType ?? frame.disposal ?? frame.gce?.disposalType ?? frame.gce?.extras?.disposal ?? 0,
    dims: frame.dims ? { ...frame.dims } : null,
    patchBytes: frame.patch?.byteLength || frame.patch?.length || 0
  };
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function serializeError(error) {
  if (!error) return null;
  return {
    code: error.code,
    message: error.message,
    recovery: error.recovery,
    returnState: error.returnState,
    cause: error.cause ? {
      name: error.cause.name,
      message: error.cause.message,
      stack: error.cause.stack
    } : null
  };
}
