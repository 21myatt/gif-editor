export const MachineEvent = Object.freeze({
  openGif: 'OPEN_GIF',
  newDocument: 'NEW',
  exportGif: 'EXPORT',
  retry: 'RETRY',
  abort: 'ABORT',
  updateCrop: 'UPDATE_CROP',
  resetCrop: 'RESET_CROP',
  showCrop: 'SHOW_CROP',
  showPreview: 'SHOW_PREVIEW',
  setOutputEdge: 'SET_OUTPUT_EDGE',
  toggleFlipX: 'TOGGLE_FLIP_X',
  toggleFlipY: 'TOGGLE_FLIP_Y',
  setLimit: 'SET_LIMIT',
  setAlpha: 'SET_ALPHA',
  setMatteColor: 'SET_MATTE_COLOR',
  setFrameStart: 'SET_FRAME_START',
  setFrameEnd: 'SET_FRAME_END',
  setSpeed: 'SET_SPEED',
  setPaletteMode: 'SET_PALETTE_MODE',
  exportSpriteSheet: 'EXPORT_SPRITE_SHEET',
  play: 'PLAY',
  pause: 'PAUSE',
  seek: 'SEEK',
  toggleTimelineMode: 'TOGGLE_TIMELINE_MODE',
  setZoom: 'SET_ZOOM'
});

export const ShortcutAction = Object.freeze({
  Space: 'togglePlayback',
  ArrowLeft: 'seekPrevious',
  ArrowRight: 'seekNext',
  Home: 'seekFirst',
  End: 'seekLast',
  Slash: 'toggleShortcutSheet',
  Escape: 'closeOverlays'
});
