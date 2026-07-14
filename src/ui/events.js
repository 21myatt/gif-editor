import { cropFromGesture } from '../domain/crop.js';
import { MachineEvent, ShortcutAction } from './constants.js';

export function bindEditorEvents({
  el,
  editor,
  getState,
  onSpriteSheetExport = () => {},
  onSpriteSheetPreview = () => {},
  onSpriteSheetDownload = () => {},
  onSpriteSheetCancel = () => {},
  onSaveProject = () => {},
  onOpenProject = () => {},
  onProjectFile = () => {},
  onCopyErrorDetails = () => {},
  onOpenShortcuts = () => {},
  onCloseShortcuts = () => {},
  onToggleShortcuts = () => {}
}) {
  const send = (event) => sendIfAllowed(editor, event);

  el.fileInput.addEventListener('change', () => el.fileInput.files[0] && send({ type: MachineEvent.openGif, file: el.fileInput.files[0] }));
  el.newButton.addEventListener('click', () => send({ type: MachineEvent.newDocument }));
  el.openProjectButton.addEventListener('click', () => onOpenProject());
  el.saveProjectButton.addEventListener('click', () => onSaveProject());
  el.projectInput.addEventListener('change', () => el.projectInput.files[0] && onProjectFile(el.projectInput.files[0]));
  el.exportButton.addEventListener('click', () => send({ type: MachineEvent.exportGif }));
  el.retryButton.addEventListener('click', () => send({ type: MachineEvent.retry }));
  el.abortButton.addEventListener('click', () => send({ type: MachineEvent.abort }));
  el.copyErrorButton.addEventListener('click', onCopyErrorDetails);
  el.shortcutHelpButton.addEventListener('click', onOpenShortcuts);
  el.shortcutCloseButton.addEventListener('click', onCloseShortcuts);

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

  el.dropZone.addEventListener('drop', (event) => event.dataTransfer.files[0] && send({ type: MachineEvent.openGif, file: event.dataTransfer.files[0] }));

  for (const id of ['cropX', 'cropY', 'cropWidth', 'cropHeight']) {
    el[id].addEventListener('change', () => send({
      type: MachineEvent.updateCrop,
      crop: { x: el.cropX.value, y: el.cropY.value, width: el.cropWidth.value, height: el.cropHeight.value }
    }));
  }

  el.outputWidth.addEventListener('change', () => send({ type: MachineEvent.setOutputEdge, value: el.outputWidth.value }));
  el.resetCrop.addEventListener('click', () => send({ type: MachineEvent.resetCrop }));
  el.cropModeButton.addEventListener('click', () => send({ type: MachineEvent.showCrop }));
  el.previewModeButton.addEventListener('click', () => send({ type: MachineEvent.showPreview }));
  el.flipX.addEventListener('click', () => send({ type: MachineEvent.toggleFlipX }));
  el.flipY.addEventListener('click', () => send({ type: MachineEvent.toggleFlipY }));
  el.sizeLimit.addEventListener('input', () => send({ type: MachineEvent.setLimit, value: el.sizeLimit.value }));
  el.sizeLimitText.addEventListener('change', () => send({ type: MachineEvent.setLimit, value: el.sizeLimitText.value }));
  el.alphaToggle.addEventListener('change', () => send({ type: MachineEvent.setAlpha, value: el.alphaToggle.checked }));
  el.matteColor.addEventListener('input', () => send({ type: MachineEvent.setMatteColor, value: el.matteColor.value }));
  el.frameStart.addEventListener('change', () => send({ type: MachineEvent.setFrameStart, value: Number(el.frameStart.value) - 1 }));
  el.frameEnd.addEventListener('change', () => send({ type: MachineEvent.setFrameEnd, value: Number(el.frameEnd.value) - 1 }));
  el.speedControl.addEventListener('input', () => send({ type: MachineEvent.setSpeed, value: el.speedControl.value }));
  el.paletteMode.addEventListener('change', () => send({ type: MachineEvent.setPaletteMode, value: el.paletteMode.value }));
  el.spriteSheetButton.addEventListener('click', () => {
    if (send({ type: MachineEvent.exportSpriteSheet })) onSpriteSheetExport();
  });
  el.spritePreviewButton.addEventListener('click', onSpriteSheetPreview);
  el.spriteDownloadButton.addEventListener('click', onSpriteSheetDownload);
  el.spriteCancelButton.addEventListener('click', onSpriteSheetCancel);
  el.playButton.addEventListener('click', () => send({ type: isPlaying(editor) ? MachineEvent.pause : MachineEvent.play }));
  el.firstFrame.addEventListener('click', () => send({ type: MachineEvent.seek, index: 0 }));
  el.lastFrame.addEventListener('click', () => send({ type: MachineEvent.seek, index: getState().frames.length - 1 }));
  el.timelineModeButton.addEventListener('click', () => send({ type: MachineEvent.toggleTimelineMode }));
  el.zoomOut.addEventListener('click', () => send({ type: MachineEvent.setZoom, value: getState().zoom - 10 }));
  el.zoomIn.addEventListener('click', () => send({ type: MachineEvent.setZoom, value: getState().zoom + 10 }));
  el.cropOverlay.addEventListener('pointerdown', (event) => startCropGesture(event, { el, editor, getState }));
  window.addEventListener('keydown', (event) => handleShortcut(event, { editor, getState, send, onCloseShortcuts, onToggleShortcuts }));
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
      type: MachineEvent.updateCrop,
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

function handleShortcut(event, { editor, getState, send, onCloseShortcuts, onToggleShortcuts }) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return;
  const state = getState();
  const action = event.code === 'Space'
    ? ShortcutAction.Space
    : event.code === 'Slash' && event.shiftKey
      ? ShortcutAction.Slash
      : ShortcutAction[event.key];

  if (action === ShortcutAction.Slash && event.shiftKey) {
    event.preventDefault();
    onToggleShortcuts();
    return;
  }

  if (action === ShortcutAction.Escape) {
    event.preventDefault();
    onCloseShortcuts();
    return;
  }

  if (!editor.getSnapshot().matches('editing')) return;

  if (action === ShortcutAction.Space) {
    event.preventDefault();
    send({ type: isPlaying(editor) ? MachineEvent.pause : MachineEvent.play });
  } else if (action === ShortcutAction.ArrowLeft) {
    event.preventDefault();
    send({ type: MachineEvent.seek, index: state.currentFrame - 1 });
  } else if (action === ShortcutAction.ArrowRight) {
    event.preventDefault();
    send({ type: MachineEvent.seek, index: state.currentFrame + 1 });
  } else if (action === ShortcutAction.Home) {
    event.preventDefault();
    send({ type: MachineEvent.seek, index: 0 });
  } else if (action === ShortcutAction.End) {
    event.preventDefault();
    send({ type: MachineEvent.seek, index: state.frames.length - 1 });
  }
}

function isEditableTarget(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
}
