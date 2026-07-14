import { defaultOptimizationStrategy } from '../config/optimization.js';
import { ErrorCode, normalizeError } from '../domain/errors.js';
import { outputSize as calculateOutputSize } from '../domain/output.js';
import { composeTo, createCompositor, drawTransformed, frameDelay } from '../services/canvas.js';
import { createSpriteSheet } from '../services/spriteSheet.js';
import { Pause, Play, refreshIcons } from './template.js';

export function createRenderer({ el }) {
  const previewCtx = el.previewCanvas.getContext('2d', { alpha: true });
  let editor = null;
  let state = null;
  let previewCompositor = null;
  let outputUrl = null;
  let spritePreviewUrl = null;
  let spritePreviewResult = null;
  let timelineBuildPending = false;
  let toastTimer = null;

  function attachActor(nextEditor) {
    editor = nextEditor;
  }

  function renderFromSnapshot(snapshot, previous) {
    state = snapshot.context;
    const wasPlaying = previous?.matches({ editing: { transport: 'playing' } }) || false;
    const playing = snapshot.matches({ editing: { transport: 'playing' } });

    if (!snapshot.matches('error')) hideError();
    if (snapshot.matches('empty')) renderEmpty();
    if (snapshot.matches('loading')) setBusy(true, 'Opening GIF', 'Parsing and decoding animation frames...', 20);

    if (snapshot.matches('buildingTimeline')) {
      showEditor();
      setBusy(true, 'Building timeline', 'Creating lightweight frame previews...', 65);
      if (!timelineBuildPending) {
        timelineBuildPending = true;
        previewCompositor = createCompositor(state.source);
        syncControls();
        renderCurrentFrame(snapshot);
        buildTimeline()
          .then(() => sendRendererEvent({ type: 'TIMELINE_READY' }))
          .catch((error) => sendRendererFailure('TIMELINE_FAILED', error))
          .finally(() => { timelineBuildPending = false; });
      }
    }

    if (snapshot.matches('editing')) {
      showEditor();
      setBusy(false);
      syncControls();
      renderCurrentFrame(snapshot);

      if (state.exportResult && state.exportResult !== previous?.context.exportResult) downloadExport(state.exportResult);
    }

    if (snapshot.matches('exporting')) {
      setPlayIcon(false);
      el.exportButton.disabled = true;
      setBusy(true, 'Optimizing GIF', 'Preparing frames...', 5);
    }

    if (snapshot.matches('error') && !previous?.matches('error')) {
      setBusy(false);
      showError(state.error);
    }

    if (playing !== wasPlaying) setPlayIcon(playing);
  }

  function renderEmpty() {
    setBusy(false);
    previewCompositor = null;
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    clearSpritePreview();
    closeSpriteSheetDialog();
    el.fileInput.value = '';
    el.editor.classList.add('hidden');
    el.emptyView.classList.remove('hidden');
    el.newButton.classList.add('hidden');
    el.exportButton.disabled = true;
    el.fileName.textContent = 'No file open';
    el.timelineStrip.replaceChildren();
  }

  function showEditor() {
    el.emptyView.classList.add('hidden');
    el.editor.classList.remove('hidden');
    el.newButton.classList.remove('hidden');
    el.exportButton.disabled = false;
    el.fileName.textContent = state.file?.name || 'GIF editor';
    el.frameCount.textContent = `${state.frames.length} frame${state.frames.length === 1 ? '' : 's'}`;
  }

  function renderCurrentFrame(snapshot = editor.getSnapshot()) {
    if (!state.frames.length || !previewCompositor) return;
    const sourceCanvas = composeTo(previewCompositor, state.frames, state.currentFrame);
    const size = outputSize();
    const cropMode = snapshot.matches({ editing: { tool: 'crop' } }) || snapshot.matches('buildingTimeline');

    if (cropMode) {
      el.previewCanvas.width = state.source.width;
      el.previewCanvas.height = state.source.height;
      previewCtx.clearRect(0, 0, state.source.width, state.source.height);
      previewCtx.drawImage(sourceCanvas, 0, 0);
      el.canvasStage.style.aspectRatio = `${state.source.width} / ${state.source.height}`;
      el.canvasStage.classList.add('crop-active');
      el.cropOverlay.classList.remove('hidden');
      positionCropOverlay();
      el.stageBadge.textContent = `${state.crop.width} x ${state.crop.height}`;
    } else {
      el.previewCanvas.width = size.width;
      el.previewCanvas.height = size.height;
      previewCtx.clearRect(0, 0, size.width, size.height);
      drawTransformed(previewCtx, sourceCanvas, state, size);
      el.canvasStage.style.aspectRatio = `${size.width} / ${size.height}`;
      el.canvasStage.classList.remove('crop-active');
      el.cropOverlay.classList.add('hidden');
      el.stageBadge.textContent = `${size.width} x ${size.height}`;
    }

    el.cropModeButton.classList.toggle('active', cropMode);
    el.previewModeButton.classList.toggle('active', !cropMode);
    el.outputDimensions.textContent = `${size.width} x ${size.height}`;
    updateTimecode();
    updateActiveFrame();
  }

  function positionCropOverlay() {
    Object.assign(el.cropOverlay.style, {
      left: `${state.crop.x / state.source.width * 100}%`,
      top: `${state.crop.y / state.source.height * 100}%`,
      width: `${state.crop.width / state.source.width * 100}%`,
      height: `${state.crop.height / state.source.height * 100}%`
    });
  }

  async function buildTimeline() {
    el.timelineStrip.replaceChildren();
    const count = Math.min(14, state.frames.length);
    const targets = [...new Set(Array.from({ length: count }, (_, index) => Math.round(index * (state.frames.length - 1) / Math.max(1, count - 1))))];
    const compositor = createCompositor(state.source);
    const thumb = document.createElement('canvas');
    thumb.width = 96;
    thumb.height = 68;
    const ctx = thumb.getContext('2d');

    for (const index of targets) {
      const sourceCanvas = composeTo(compositor, state.frames, index);
      ctx.clearRect(0, 0, thumb.width, thumb.height);
      ctx.drawImage(sourceCanvas, state.crop.x, state.crop.y, state.crop.width, state.crop.height, 0, 0, thumb.width, thumb.height);
      const button = document.createElement('button');
      button.className = 'frame';
      button.type = 'button';
      button.dataset.index = index;
      button.setAttribute('aria-label', `Go to frame ${index + 1}`);
      const image = document.createElement('img');
      image.alt = '';
      image.src = thumb.toDataURL('image/webp', 0.64);
      const label = document.createElement('span');
      label.textContent = index + 1;
      button.append(image, label);
      button.addEventListener('click', () => sendRendererEvent({ type: 'SEEK', index }));
      el.timelineStrip.append(button);
      await nextPaint();
    }
    updateActiveFrame();
  }

  function syncControls() {
    el.cropX.value = state.crop.x;
    el.cropY.value = state.crop.y;
    el.cropWidth.value = state.crop.width;
    el.cropHeight.value = state.crop.height;
    el.outputWidth.value = state.outputEdge;
    const limitMb = state.maxBytes / 1_000_000;
    el.sizeLimit.value = limitMb;
    el.sizeLimitText.value = limitMb;
    el.frameStart.value = state.frameRange.start + 1;
    el.frameEnd.value = state.frameRange.end + 1;
    el.frameEnd.max = state.frames.length || 1;
    el.frameStart.max = state.frames.length || 1;
    el.speedControl.value = state.speed;
    el.speedValue.textContent = `${state.speed}x`;
    el.paletteMode.value = state.paletteMode;
    el.flipX.classList.toggle('active', state.flipX);
    el.flipY.classList.toggle('active', state.flipY);
    el.flipX.setAttribute('aria-pressed', String(state.flipX));
    el.flipY.setAttribute('aria-pressed', String(state.flipY));
    el.canvasStage.style.width = `min(${Math.round(512 * state.zoom / 100)}px, 80vw)`;
    el.zoomLabel.textContent = `${state.zoom}%`;
    updateReductionMetric();
  }

  function outputSize(maxEdge = state.outputEdge) {
    return calculateOutputSize(state.crop, maxEdge, defaultOptimizationStrategy);
  }

  function setPlayIcon(playing) {
    el.playButton.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}"></i>`;
    el.playButton.title = playing ? 'Pause' : 'Play';
    refreshIcons({ Play, Pause });
  }

  function downloadExport(result) {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = outputUrl;
    link.download = `${state.file.name.replace(/\.gif$/i, '')}-framecut.gif`;
    link.click();
    const reduction = Math.max(0, Math.round((1 - result.blob.size / state.file.size) * 100));
    showToast(`Exported ${formatBytes(result.blob.size)} - ${result.width} x ${result.height} - ${reduction}% smaller`);
  }

  function updateTimecode() {
    const elapsed = state.frames.slice(0, state.currentFrame).reduce((sum, frame) => sum + frameDelay(frame), 0);
    const total = state.frames.reduce((sum, frame) => sum + frameDelay(frame), 0);
    el.timecode.textContent = `${formatTime(elapsed)} / ${formatTime(total)}`;
  }

  function updateActiveFrame() {
    let closest = null;
    let distance = Infinity;
    el.timelineStrip.querySelectorAll('.frame').forEach((frame) => {
      const nextDistance = Math.abs(Number(frame.dataset.index) - state.currentFrame);
      if (nextDistance < distance) {
        distance = nextDistance;
        closest = frame;
      }
      frame.classList.remove('active');
    });
    closest?.classList.add('active');
  }

  function updateReductionMetric() {
    if (!state.file) {
      el.reductionMetric.textContent = '-';
      return;
    }
    const target = Math.max(0, Math.round((1 - state.maxBytes / state.file.size) * 100));
    el.reductionMetric.textContent = state.file.size > state.maxBytes ? `${target}% or more` : 'Already below limit';
    el.exportLabel.textContent = `Export < ${formatBytes(state.maxBytes)}`;
  }

  function setBusy(busy, title = '', message = '', progress = 0) {
    el.progress.classList.toggle('hidden', !busy);
    if (busy) setProgress(title, message, progress);
  }

  function setProgress(title, message, progress) {
    el.progressTitle.textContent = title;
    el.progressText.textContent = message;
    el.progressBar.style.width = `${progress}%`;
  }

  function showError(error) {
    el.errorTitle.textContent = error?.code || 'Error';
    el.errorMessage.textContent = error?.message || 'An unexpected error occurred.';
    el.retryButton.classList.toggle('hidden', error?.recovery === 'abort');
    el.errorDialog.classList.remove('hidden');
    el.abortButton.focus();
  }

  function hideError() {
    el.errorDialog.classList.add('hidden');
  }

  function showToast(message, error = false) {
    window.clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.toggle('error', error);
    el.toast.classList.remove('hidden');
    toastTimer = window.setTimeout(() => el.toast.classList.add('hidden'), 5000);
  }

  function openSpriteSheetDialog() {
    const frameCount = Math.max(1, state.frameRange.end - state.frameRange.start + 1);
    const columns = Math.ceil(Math.sqrt(frameCount));
    const rows = Math.ceil(frameCount / columns);
    el.spriteColumns.value = columns;
    el.spriteRows.value = rows;
    clearSpritePreview();
    el.spriteMeta.textContent = `${frameCount} selected frame${frameCount === 1 ? '' : 's'}`;
    el.spriteDialog.classList.remove('hidden');
    el.spriteColumns.focus();
  }

  function closeSpriteSheetDialog() {
    el.spriteDialog.classList.add('hidden');
  }

  async function previewSpriteSheet() {
    try {
      setBusy(true, 'Preparing sprite sheet', 'Compositing selected frames...', 25);
      clearSpritePreview();
      const result = await createSpriteSheet(state, spriteLayoutOptions());
      spritePreviewResult = result;
      spritePreviewUrl = URL.createObjectURL(result.blob);
      el.spritePreview.src = spritePreviewUrl;
      el.spriteDownloadButton.disabled = false;
      el.spriteMeta.textContent = `${result.columns} x ${result.rows} grid - ${result.width} x ${result.height}px - ${result.frames} frames`;
    } catch (error) {
      el.spriteMeta.textContent = error.message || 'Sprite sheet preview failed.';
      showToast(error.message || 'Sprite sheet preview failed.', true);
    } finally {
      setBusy(false);
    }
  }

  function downloadSpriteSheet() {
    if (!spritePreviewResult || !spritePreviewUrl) return;
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = spritePreviewUrl;
    spritePreviewUrl = null;
    const link = document.createElement('a');
    link.href = outputUrl;
    link.download = `${state.file.name.replace(/\.gif$/i, '')}-spritesheet.png`;
    link.click();
    showToast(`Sprite sheet ${spritePreviewResult.width} x ${spritePreviewResult.height} exported`);
    closeSpriteSheetDialog();
    spritePreviewResult = null;
    el.spritePreview.removeAttribute('src');
    el.spriteDownloadButton.disabled = true;
  }

  function clearSpritePreview() {
    if (spritePreviewUrl) URL.revokeObjectURL(spritePreviewUrl);
    spritePreviewUrl = null;
    spritePreviewResult = null;
    el.spritePreview.removeAttribute('src');
    el.spriteDownloadButton.disabled = true;
  }

  function spriteLayoutOptions() {
    return {
      columns: el.spriteColumns.value,
      rows: el.spriteRows.value
    };
  }

  function sendRendererEvent(event) {
    if (!editor.getSnapshot().can(event)) return false;
    editor.send(event);
    return true;
  }

  function sendRendererFailure(type, error) {
    return sendRendererEvent({
      type,
      error: normalizeError(error, ErrorCode.DECODE_FAILED)
    });
  }

  return { attachActor, renderFromSnapshot, setProgress, openSpriteSheetDialog, closeSpriteSheetDialog, previewSpriteSheet, downloadSpriteSheet };
}

function formatBytes(bytes) {
  return bytes < 1_000_000 ? `${(bytes / 1000).toFixed(bytes < 100_000 ? 1 : 0)} KB` : `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
