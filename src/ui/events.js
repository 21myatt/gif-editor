import { cropFromGesture } from '../domain/crop.js';

export function bindEditorEvents({ el, editor, getState, onSpriteSheetExport = () => {}, onSpriteSheetPreview = () => {}, onSpriteSheetDownload = () => {}, onSpriteSheetCancel = () => {} }) {
  const send = (event) => sendIfAllowed(editor, event);

  el.fileInput.addEventListener('change', () => el.fileInput.files[0] && send({ type: 'OPEN_GIF', file: el.fileInput.files[0] }));
  el.newButton.addEventListener('click', () => send({ type: 'NEW' }));
  el.exportButton.addEventListener('click', () => send({ type: 'EXPORT' }));
  el.retryButton.addEventListener('click', () => send({ type: 'RETRY' }));
  el.abortButton.addEventListener('click', () => send({ type: 'ABORT' }));

  for (const eventName of ['dragenter', 'dragover']) {
    el.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropZone.classList.add('dragging');
    });
  }

  for (const eventName of ['dragleave', 'drop']) {
    el.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropZone.classList.remove('dragging');
    });
  }

  el.dropZone.addEventListener('drop', (event) => event.dataTransfer.files[0] && send({ type: 'OPEN_GIF', file: event.dataTransfer.files[0] }));

  for (const id of ['cropX', 'cropY', 'cropWidth', 'cropHeight']) {
    el[id].addEventListener('change', () => send({
      type: 'UPDATE_CROP',
      crop: { x: el.cropX.value, y: el.cropY.value, width: el.cropWidth.value, height: el.cropHeight.value }
    }));
  }

  el.outputWidth.addEventListener('change', () => send({ type: 'SET_OUTPUT_EDGE', value: el.outputWidth.value }));
  el.resetCrop.addEventListener('click', () => send({ type: 'RESET_CROP' }));
  el.cropModeButton.addEventListener('click', () => send({ type: 'SHOW_CROP' }));
  el.previewModeButton.addEventListener('click', () => send({ type: 'SHOW_PREVIEW' }));
  el.flipX.addEventListener('click', () => send({ type: 'TOGGLE_FLIP_X' }));
  el.flipY.addEventListener('click', () => send({ type: 'TOGGLE_FLIP_Y' }));
  el.sizeLimit.addEventListener('input', () => send({ type: 'SET_LIMIT', value: el.sizeLimit.value }));
  el.sizeLimitText.addEventListener('change', () => send({ type: 'SET_LIMIT', value: el.sizeLimitText.value }));
  el.frameStart.addEventListener('change', () => send({ type: 'SET_FRAME_START', value: Number(el.frameStart.value) - 1 }));
  el.frameEnd.addEventListener('change', () => send({ type: 'SET_FRAME_END', value: Number(el.frameEnd.value) - 1 }));
  el.speedControl.addEventListener('input', () => send({ type: 'SET_SPEED', value: el.speedControl.value }));
  el.paletteMode.addEventListener('change', () => send({ type: 'SET_PALETTE_MODE', value: el.paletteMode.value }));
  el.spriteSheetButton.addEventListener('click', () => {
    if (send({ type: 'EXPORT_SPRITE_SHEET' })) onSpriteSheetExport();
  });
  el.spritePreviewButton.addEventListener('click', onSpriteSheetPreview);
  el.spriteDownloadButton.addEventListener('click', onSpriteSheetDownload);
  el.spriteCancelButton.addEventListener('click', onSpriteSheetCancel);
  el.playButton.addEventListener('click', () => send({ type: isPlaying(editor) ? 'PAUSE' : 'PLAY' }));
  el.firstFrame.addEventListener('click', () => send({ type: 'SEEK', index: 0 }));
  el.lastFrame.addEventListener('click', () => send({ type: 'SEEK', index: getState().frames.length - 1 }));
  el.zoomOut.addEventListener('click', () => send({ type: 'SET_ZOOM', value: getState().zoom - 10 }));
  el.zoomIn.addEventListener('click', () => send({ type: 'SET_ZOOM', value: getState().zoom + 10 }));
  el.cropOverlay.addEventListener('pointerdown', (event) => startCropGesture(event, { el, editor, getState }));
}

function startCropGesture(event, { el, editor, getState }) {
  if (!editor.getSnapshot().matches({ editing: { tool: 'crop' } }) || event.button !== 0) return;
  event.preventDefault();
  const state = getState();
  const handle = event.target.closest('[data-handle]')?.dataset.handle || 'move';
  const stageRect = el.canvasStage.getBoundingClientRect();
  const start = { x: event.clientX, y: event.clientY, crop: { ...state.crop } };
  el.cropOverlay.setPointerCapture(event.pointerId);
  el.cropOverlay.classList.add('dragging');

  const onMove = (moveEvent) => {
    const nextState = getState();
    sendIfAllowed(editor, {
      type: 'UPDATE_CROP',
      crop: cropFromGesture(
        start.crop,
        handle,
        (moveEvent.clientX - start.x) * nextState.source.width / stageRect.width,
        (moveEvent.clientY - start.y) * nextState.source.height / stageRect.height,
        nextState.source
      )
    });
  };

  const onEnd = () => {
    el.cropOverlay.classList.remove('dragging');
    el.cropOverlay.removeEventListener('pointermove', onMove);
    el.cropOverlay.removeEventListener('pointerup', onEnd);
    el.cropOverlay.removeEventListener('pointercancel', onEnd);
  };

  el.cropOverlay.addEventListener('pointermove', onMove);
  el.cropOverlay.addEventListener('pointerup', onEnd);
  el.cropOverlay.addEventListener('pointercancel', onEnd);
}

function isPlaying(editor) {
  return editor.getSnapshot().matches({ editing: { transport: 'playing' } });
}

function sendIfAllowed(editor, event) {
  const snapshot = editor.getSnapshot();
  if (!snapshot.can(event)) return false;
  editor.send(event);
  return true;
}
