import { parseGIF, decompressFrames } from 'gifuct-js';
import GIF from 'gif.js.optimized';
import { createIcons, Upload, Download, Crop, Scaling, FlipHorizontal2, FlipVertical2, Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, RotateCcw, FilePlus2, Gauge } from 'lucide';
import './style.css';

const FALLBACK_SIZE = { width: 720, height: 1280 };
const DEFAULT_CROP = { x: 0, y: 200, width: 720, height: 500 };
const TRANSPARENT_KEY = 0xff00ff;

const state = {
  file: null,
  parsed: null,
  frames: [],
  source: { ...FALLBACK_SIZE },
  crop: { ...DEFAULT_CROP },
  outputWidth: 512,
  maxBytes: 1_000_000,
  flipX: false,
  flipY: false,
  cropMode: true,
  currentFrame: 0,
  playing: false,
  playTimer: null,
  zoom: 100,
  previewCompositor: null,
  outputUrl: null,
  busy: false
};

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">F</span><span>Framecut</span></div>
      <div id="fileName" class="file-name">No file open</div>
      <div class="header-actions">
        <button id="newButton" class="button secondary hidden" type="button"><i data-lucide="file-plus-2"></i><span class="button-label">New</span></button>
        <button id="exportButton" class="button primary" type="button" disabled><i data-lucide="download"></i><span id="exportLabel" class="button-label">Export GIF</span></button>
      </div>
    </header>

    <main id="emptyView" class="empty-view">
      <label id="dropZone" class="drop-zone" for="fileInput">
        <span class="drop-icon"><i data-lucide="upload"></i></span>
        <h1>Open a GIF to begin</h1>
        <p>Drop any GIF here, or choose one from your device.</p>
        <span class="button">Choose GIF</span>
        <small>Processed locally. Nothing is uploaded.</small>
        <input id="fileInput" type="file" accept="image/gif,.gif" hidden>
      </label>
    </main>

    <main id="editor" class="editor hidden">
      <aside class="sidebar" aria-label="Editing tools">
        <section class="tool-group">
          <h2 class="group-title"><i data-lucide="crop"></i> Crop</h2>
          <div class="segmented crop-mode" aria-label="Canvas mode">
            <button id="cropModeButton" class="segment active" type="button">Crop</button>
            <button id="previewModeButton" class="segment" type="button">Preview</button>
          </div>
          <div class="field-grid">
            ${numberField('cropX', 'X', 0)}
            ${numberField('cropY', 'Y', 200)}
            ${numberField('cropWidth', 'Width', 720)}
            ${numberField('cropHeight', 'Height', 500)}
          </div>
          <button id="resetCrop" class="button secondary" type="button" style="width:100%;margin-top:10px"><i data-lucide="rotate-ccw"></i>Reset crop</button>
        </section>

        <section class="tool-group">
          <h2 class="group-title"><i data-lucide="scaling"></i> Output</h2>
          <div class="field full">
            <label for="outputWidth">Maximum edge</label>
            <div class="input-wrap"><input id="outputWidth" type="number" min="1" max="512" value="512"><span class="unit">px</span></div>
          </div>
          <div class="metric"><span>Result</span><strong id="outputDimensions">512 × 356</strong></div>
        </section>

        <section class="tool-group">
          <h2 class="group-title"><i data-lucide="gauge"></i> Optimize</h2>
          <div class="segmented" aria-label="Flip controls">
            <button id="flipX" class="segment" type="button" aria-pressed="false"><i data-lucide="flip-horizontal-2"></i>Horizontal</button>
            <button id="flipY" class="segment" type="button" aria-pressed="false"><i data-lucide="flip-vertical-2"></i>Vertical</button>
          </div>
          <div class="field full" style="margin-top:14px">
            <label for="sizeLimit">File size limit</label>
            <div class="range-row">
              <input id="sizeLimit" type="range" min="0.25" max="5" step="0.25" value="1">
              <div class="input-wrap"><input id="sizeLimitText" type="number" min="0.25" max="5" step="0.25" value="1"><span class="unit">MB</span></div>
            </div>
          </div>
          <div class="metric"><span>Target reduction</span><strong id="reductionMetric">—</strong></div>
        </section>
      </aside>

      <section class="workspace" aria-label="GIF preview">
        <div id="canvasStage" class="canvas-stage">
          <canvas id="previewCanvas" width="512" height="356"></canvas>
          <div id="cropOverlay" class="crop-overlay hidden" role="application" aria-label="Crop selection">
            <span class="crop-grid crop-grid-v one"></span><span class="crop-grid crop-grid-v two"></span>
            <span class="crop-grid crop-grid-h one"></span><span class="crop-grid crop-grid-h two"></span>
            <button class="crop-handle nw" data-handle="nw" type="button" aria-label="Resize from top left"></button>
            <button class="crop-handle n" data-handle="n" type="button" aria-label="Resize from top"></button>
            <button class="crop-handle ne" data-handle="ne" type="button" aria-label="Resize from top right"></button>
            <button class="crop-handle e" data-handle="e" type="button" aria-label="Resize from right"></button>
            <button class="crop-handle se" data-handle="se" type="button" aria-label="Resize from bottom right"></button>
            <button class="crop-handle s" data-handle="s" type="button" aria-label="Resize from bottom"></button>
            <button class="crop-handle sw" data-handle="sw" type="button" aria-label="Resize from bottom left"></button>
            <button class="crop-handle w" data-handle="w" type="button" aria-label="Resize from left"></button>
          </div>
          <span id="stageBadge" class="stage-badge">512 × 356</span>
        </div>
        <div class="zoom-controls" aria-label="Zoom controls">
          <button id="zoomOut" class="icon-button" type="button" title="Zoom out"><i data-lucide="zoom-out"></i></button>
          <span id="zoomLabel" class="zoom-label">100%</span>
          <button id="zoomIn" class="icon-button" type="button" title="Zoom in"><i data-lucide="zoom-in"></i></button>
        </div>
      </section>

      <section class="timeline" aria-label="Timeline">
        <div class="transport">
          <div class="transport-left">
            <button id="firstFrame" class="icon-button" type="button" title="First frame"><i data-lucide="skip-back"></i></button>
            <button id="playButton" class="icon-button" type="button" title="Play"><i data-lucide="play"></i></button>
            <button id="lastFrame" class="icon-button" type="button" title="Last frame"><i data-lucide="skip-forward"></i></button>
            <span id="timecode" class="timecode">00:00 / 00:00</span>
          </div>
          <div class="transport-right"><span id="frameCount" class="timecode">0 frames</span></div>
        </div>
        <div id="timelineStrip" class="timeline-strip"></div>
      </section>
    </main>

    <div id="progress" class="progress hidden" role="status" aria-live="polite">
      <div class="progress-panel">
        <strong id="progressTitle">Preparing GIF</strong>
        <p id="progressText">Reading frames…</p>
        <div class="progress-track"><div id="progressBar" class="progress-bar"></div></div>
      </div>
    </div>
    <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>
  </div>`;

createIcons({ icons: { Upload, Download, Crop, Scaling, FlipHorizontal2, FlipVertical2, Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, RotateCcw, FilePlus2, Gauge } });

const el = Object.fromEntries([
  'fileInput','dropZone','emptyView','editor','fileName','newButton','exportButton','exportLabel',
  'cropX','cropY','cropWidth','cropHeight','resetCrop','cropModeButton','previewModeButton','cropOverlay','outputWidth','outputDimensions','flipX','flipY',
  'sizeLimit','sizeLimitText','reductionMetric','previewCanvas','canvasStage','stageBadge','zoomOut','zoomIn',
  'zoomLabel','firstFrame','playButton','lastFrame','timecode','frameCount','timelineStrip','progress',
  'progressTitle','progressText','progressBar','toast'
].map((id) => [id, document.getElementById(id)]));

const previewCtx = el.previewCanvas.getContext('2d', { alpha: true });

el.fileInput.addEventListener('change', () => el.fileInput.files[0] && loadFile(el.fileInput.files[0]));
el.newButton.addEventListener('click', resetApp);
el.exportButton.addEventListener('click', exportGif);

for (const eventName of ['dragenter', 'dragover']) {
  el.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); el.dropZone.classList.add('dragging'); });
}
for (const eventName of ['dragleave', 'drop']) {
  el.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); el.dropZone.classList.remove('dragging'); });
}
el.dropZone.addEventListener('drop', (event) => event.dataTransfer.files[0] && loadFile(event.dataTransfer.files[0]));

for (const id of ['cropX','cropY','cropWidth','cropHeight']) el[id].addEventListener('change', updateCrop);
el.outputWidth.addEventListener('change', updateOutputWidth);
el.resetCrop.addEventListener('click', () => { state.crop = initialCrop(state.source); syncControls(); renderCurrentFrame(); });
el.cropModeButton.addEventListener('click', () => setCanvasMode(true));
el.previewModeButton.addEventListener('click', () => setCanvasMode(false));
el.flipX.addEventListener('click', () => toggleFlip('flipX'));
el.flipY.addEventListener('click', () => toggleFlip('flipY'));
el.sizeLimit.addEventListener('input', () => setSizeLimit(el.sizeLimit.value));
el.sizeLimitText.addEventListener('change', () => setSizeLimit(el.sizeLimitText.value));
el.playButton.addEventListener('click', togglePlayback);
el.firstFrame.addEventListener('click', () => seekFrame(0));
el.lastFrame.addEventListener('click', () => seekFrame(state.frames.length - 1));
el.zoomOut.addEventListener('click', () => setZoom(state.zoom - 10));
el.zoomIn.addEventListener('click', () => setZoom(state.zoom + 10));
el.cropOverlay.addEventListener('pointerdown', startCropGesture);

async function loadFile(file) {
  if (!file.name.toLowerCase().endsWith('.gif') && file.type !== 'image/gif') return showToast('Choose a GIF file.', true);
  setBusy(true, 'Opening GIF', 'Parsing animation frames…', 8);
  stopPlayback();

  try {
    const buffer = await file.arrayBuffer();
    const parsed = parseGIF(buffer);
    const source = getLogicalSize(parsed);
    if (!source.width || !source.height) throw new Error('Could not read this GIF’s canvas dimensions.');

    setProgress('Decoding frames', 'Preserving transparency and disposal data…', 35);
    const frames = decompressFrames(parsed, true);
    if (!frames.length) throw new Error('No animation frames were found in this GIF.');

    state.file = file;
    state.parsed = parsed;
    state.frames = frames;
    state.source = source;
    state.crop = initialCrop(source);
    state.outputWidth = 512;
    state.currentFrame = 0;
    state.cropMode = true;
    state.previewCompositor = createCompositor(source);

    el.emptyView.classList.add('hidden');
    el.editor.classList.remove('hidden');
    el.newButton.classList.remove('hidden');
    el.exportButton.disabled = false;
    el.fileName.textContent = file.name;
    el.frameCount.textContent = `${frames.length} frame${frames.length === 1 ? '' : 's'}`;
    syncControls();
    renderCurrentFrame();

    setProgress('Building timeline', 'Creating lightweight frame previews…', 65);
    await buildTimeline();
    setProgress('Ready', `${frames.length} frames loaded locally.`, 100);
    setTimeout(() => setBusy(false), 180);
  } catch (error) {
    setBusy(false);
    showToast(error.message || 'Could not open this GIF.', true);
  }
}

function createCompositor(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }), index: -1, restore: null };
}

function composeTo(compositor, targetIndex) {
  if (targetIndex < compositor.index || targetIndex > compositor.index + 1) {
    compositor.ctx.clearRect(0, 0, compositor.canvas.width, compositor.canvas.height);
    compositor.index = -1;
    compositor.restore = null;
  }

  for (let index = compositor.index + 1; index <= targetIndex; index += 1) {
    if (index > 0) applyDisposal(state.frames[index - 1], compositor);
    const frame = state.frames[index];
    compositor.restore = getDisposal(frame) === 3
      ? compositor.ctx.getImageData(0, 0, compositor.canvas.width, compositor.canvas.height)
      : null;
    drawPatch(frame, compositor.ctx);
    compositor.index = index;
  }
  return compositor.canvas;
}

function drawPatch(frame, targetCtx) {
  const patch = document.createElement('canvas');
  patch.width = frame.dims.width;
  patch.height = frame.dims.height;
  patch.getContext('2d').putImageData(new ImageData(frame.patch, frame.dims.width, frame.dims.height), 0, 0);
  targetCtx.drawImage(patch, frame.dims.left, frame.dims.top);
}

function applyDisposal(frame, compositor) {
  const disposal = getDisposal(frame);
  if (disposal === 2) {
    compositor.ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
  } else if (disposal === 3 && compositor.restore) {
    compositor.ctx.putImageData(compositor.restore, 0, 0);
  }
  compositor.restore = null;
}

function renderCurrentFrame() {
  if (!state.frames.length) return;
  const sourceCanvas = composeTo(state.previewCompositor, state.currentFrame);
  const size = outputSize();
  if (state.cropMode) {
    el.previewCanvas.width = state.source.width;
    el.previewCanvas.height = state.source.height;
    previewCtx.clearRect(0, 0, state.source.width, state.source.height);
    previewCtx.drawImage(sourceCanvas, 0, 0);
    el.canvasStage.style.aspectRatio = `${state.source.width} / ${state.source.height}`;
    el.canvasStage.classList.add('crop-active');
    el.cropOverlay.classList.remove('hidden');
    positionCropOverlay();
    el.stageBadge.textContent = `${state.crop.width} × ${state.crop.height}`;
  } else {
    el.previewCanvas.width = size.width;
    el.previewCanvas.height = size.height;
    previewCtx.clearRect(0, 0, size.width, size.height);
    drawTransformed(previewCtx, sourceCanvas, size);
    el.canvasStage.style.aspectRatio = `${size.width} / ${size.height}`;
    el.canvasStage.classList.remove('crop-active');
    el.cropOverlay.classList.add('hidden');
    el.stageBadge.textContent = `${size.width} × ${size.height}`;
  }
  el.outputDimensions.textContent = `${size.width} × ${size.height}`;
  updateTimecode();
  updateActiveFrame();
}

function setCanvasMode(cropMode) {
  state.cropMode = cropMode;
  el.cropModeButton.classList.toggle('active', cropMode);
  el.previewModeButton.classList.toggle('active', !cropMode);
  renderCurrentFrame();
}

function positionCropOverlay() {
  const left = state.crop.x / state.source.width * 100;
  const top = state.crop.y / state.source.height * 100;
  const width = state.crop.width / state.source.width * 100;
  const height = state.crop.height / state.source.height * 100;
  Object.assign(el.cropOverlay.style, { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` });
}

function startCropGesture(event) {
  if (!state.cropMode || event.button !== 0) return;
  event.preventDefault();
  const handle = event.target.closest('[data-handle]')?.dataset.handle || 'move';
  const stageRect = el.canvasStage.getBoundingClientRect();
  const start = { x: event.clientX, y: event.clientY, crop: { ...state.crop } };
  el.cropOverlay.setPointerCapture(event.pointerId);
  el.cropOverlay.classList.add('dragging');

  const onMove = (moveEvent) => {
    const dx = (moveEvent.clientX - start.x) * state.source.width / stageRect.width;
    const dy = (moveEvent.clientY - start.y) * state.source.height / stageRect.height;
    state.crop = cropFromGesture(start.crop, handle, dx, dy);
    syncControls();
    positionCropOverlay();
    el.stageBadge.textContent = `${state.crop.width} × ${state.crop.height}`;
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

function cropFromGesture(original, handle, dx, dy) {
  const minSize = 24;
  let left = original.x;
  let top = original.y;
  let right = original.x + original.width;
  let bottom = original.y + original.height;

  if (handle === 'move') {
    left = Math.min(state.source.width - original.width, Math.max(0, original.x + dx));
    top = Math.min(state.source.height - original.height, Math.max(0, original.y + dy));
    right = left + original.width;
    bottom = top + original.height;
  } else {
    if (handle.includes('w')) left = Math.min(right - minSize, Math.max(0, original.x + dx));
    if (handle.includes('e')) right = Math.max(left + minSize, Math.min(state.source.width, original.x + original.width + dx));
    if (handle.includes('n')) top = Math.min(bottom - minSize, Math.max(0, original.y + dy));
    if (handle.includes('s')) bottom = Math.max(top + minSize, Math.min(state.source.height, original.y + original.height + dy));
  }
  return { x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) };
}

function drawTransformed(ctx, sourceCanvas, size) {
  ctx.save();
  ctx.translate(state.flipX ? size.width : 0, state.flipY ? size.height : 0);
  ctx.scale(state.flipX ? -1 : 1, state.flipY ? -1 : 1);
  ctx.drawImage(sourceCanvas, state.crop.x, state.crop.y, state.crop.width, state.crop.height, 0, 0, size.width, size.height);
  ctx.restore();
}

async function buildTimeline() {
  el.timelineStrip.replaceChildren();
  const count = Math.min(14, state.frames.length);
  const targets = [...new Set(Array.from({ length: count }, (_, i) => Math.round(i * (state.frames.length - 1) / Math.max(1, count - 1))))];
  const compositor = createCompositor(state.source);
  const thumb = document.createElement('canvas');
  thumb.width = 96;
  thumb.height = 68;
  const ctx = thumb.getContext('2d');

  for (const index of targets) {
    const sourceCanvas = composeTo(compositor, index);
    ctx.clearRect(0, 0, thumb.width, thumb.height);
    ctx.drawImage(sourceCanvas, state.crop.x, state.crop.y, state.crop.width, state.crop.height, 0, 0, thumb.width, thumb.height);
    const button = document.createElement('button');
    button.className = 'frame';
    button.type = 'button';
    button.dataset.index = index;
    button.setAttribute('aria-label', `Go to frame ${index + 1}`);
    const image = document.createElement('img');
    image.alt = '';
    image.src = thumb.toDataURL('image/webp', .64);
    const label = document.createElement('span');
    label.textContent = index + 1;
    button.append(image, label);
    button.addEventListener('click', () => seekFrame(index));
    el.timelineStrip.append(button);
    await nextPaint();
  }
  updateActiveFrame();
}

function updateCrop() {
  const next = {
    x: clampNumber(el.cropX.value, 0, state.source.width - 1),
    y: clampNumber(el.cropY.value, 0, state.source.height - 1),
    width: clampNumber(el.cropWidth.value, 1, state.source.width),
    height: clampNumber(el.cropHeight.value, 1, state.source.height)
  };
  next.width = Math.min(next.width, state.source.width - next.x);
  next.height = Math.min(next.height, state.source.height - next.y);
  state.crop = next;
  syncControls();
  renderCurrentFrame();
}

function updateOutputWidth() {
  state.outputWidth = clampNumber(el.outputWidth.value, 1, 512);
  syncControls();
  renderCurrentFrame();
}

function toggleFlip(key) {
  state[key] = !state[key];
  const button = key === 'flipX' ? el.flipX : el.flipY;
  button.classList.toggle('active', state[key]);
  button.setAttribute('aria-pressed', String(state[key]));
  renderCurrentFrame();
}

function setSizeLimit(value) {
  const mb = Math.min(5, Math.max(.25, Number(value) || 1));
  state.maxBytes = Math.round(mb * 1_000_000);
  el.sizeLimit.value = mb;
  el.sizeLimitText.value = mb;
  updateReductionMetric();
}

function syncControls() {
  el.cropX.value = state.crop.x;
  el.cropY.value = state.crop.y;
  el.cropWidth.value = state.crop.width;
  el.cropHeight.value = state.crop.height;
  el.outputWidth.value = state.outputWidth;
  updateReductionMetric();
}

function outputSize(maxEdge = state.outputWidth) {
  const scale = Math.min(1, Math.min(maxEdge, 512) / Math.max(state.crop.width, state.crop.height));
  return {
    width: Math.max(1, Math.round(state.crop.width * scale)),
    height: Math.max(1, Math.round(state.crop.height * scale))
  };
}

function seekFrame(index) {
  stopPlayback();
  state.currentFrame = Math.max(0, Math.min(state.frames.length - 1, index));
  renderCurrentFrame();
}

function togglePlayback() {
  if (state.playing) return stopPlayback();
  state.playing = true;
  setPlayIcon(true);
  playNext();
}

function playNext() {
  if (!state.playing) return;
  state.currentFrame = (state.currentFrame + 1) % state.frames.length;
  renderCurrentFrame();
  state.playTimer = window.setTimeout(playNext, frameDelay(state.frames[state.currentFrame]));
}

function stopPlayback() {
  state.playing = false;
  window.clearTimeout(state.playTimer);
  setPlayIcon(false);
}

function setPlayIcon(playing) {
  if (!el.playButton) return;
  el.playButton.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}"></i>`;
  el.playButton.title = playing ? 'Pause' : 'Play';
  createIcons({ icons: { Play, Pause }, attrs: { 'aria-hidden': 'true' } });
}

async function exportGif() {
  if (state.busy || !state.frames.length) return;
  stopPlayback();
  setBusy(true, 'Optimizing GIF', 'Preparing frames…', 5);
  el.exportButton.disabled = true;

  try {
    const result = await encodeUnderLimit();
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    state.outputUrl = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = state.outputUrl;
    link.download = `${state.file.name.replace(/\.gif$/i, '')}-framecut.gif`;
    link.click();
    const reduction = Math.max(0, Math.round((1 - result.blob.size / state.file.size) * 100));
    showToast(`Exported ${formatBytes(result.blob.size)} · ${result.width} × ${result.height} · ${reduction}% smaller`);
  } catch (error) {
    showToast(error.message || 'Export failed.', true);
  } finally {
    setBusy(false);
    el.exportButton.disabled = false;
  }
}

async function encodeUnderLimit() {
  const widths = [...new Set([state.outputWidth, 480, 420, 360, 300, 240, 128, 64, 32, 16, 8, 1]
    .map((value) => Math.min(value, state.outputWidth))
    .filter((value) => value >= 1))];
  const attempts = [];
  for (const width of widths) {
    attempts.push({ width, sampleEvery: width === state.outputWidth ? 1 : 2, quality: width === state.outputWidth ? 10 : 18 });
    attempts.push({ width, sampleEvery: width >= 420 ? 2 : 3, quality: 24 });
  }

  let smallest = null;
  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    const size = outputSize(attempt.width);
    setProgress('Optimizing GIF', `Pass ${i + 1} of ${attempts.length} · ${size.width} × ${size.height}`, 8 + (i / attempts.length) * 84);
    const blob = await encodeGif({ ...attempt, ...size });
    if (!smallest || blob.size < smallest.blob.size) smallest = { blob, ...size };
    if (blob.size < state.maxBytes) return { blob, ...size };
    await nextPaint();
  }
  throw new Error(`Could not reach ${formatBytes(state.maxBytes)}. Smallest result was ${formatBytes(smallest.blob.size)}.`);
}

function encodeGif(options) {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: Math.min(4, navigator.hardwareConcurrency || 2),
      quality: options.quality,
      width: options.width,
      height: options.height,
      transparent: TRANSPARENT_KEY,
      workerScript: '/gif.worker.js'
    });
    const compositor = createCompositor(state.source);
    const output = document.createElement('canvas');
    output.width = options.width;
    output.height = options.height;
    const ctx = output.getContext('2d', { willReadFrequently: true });

    for (let index = 0; index < state.frames.length; index += options.sampleEvery) {
      const source = composeTo(compositor, index);
      ctx.clearRect(0, 0, options.width, options.height);
      drawTransformed(ctx, source, options);
      applyTransparencyKey(ctx, options.width, options.height);
      let delay = 0;
      for (let offset = 0; offset < options.sampleEvery && index + offset < state.frames.length; offset += 1) {
        delay += frameDelay(state.frames[index + offset]);
      }
      gif.addFrame(ctx, { copy: true, delay });
      for (let skipped = index + 1; skipped < Math.min(index + options.sampleEvery, state.frames.length); skipped += 1) composeTo(compositor, skipped);
    }

    gif.on('progress', (value) => el.progressBar.style.width = `${Math.round(10 + value * 85)}%`);
    gif.on('finished', resolve);
    gif.on('abort', () => reject(new Error('GIF encoding was interrupted.')));
    try { gif.render(); } catch (error) { reject(error); }
  });
}

function applyTransparencyKey(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] < 128) {
      image.data[i] = 255;
      image.data[i + 1] = 0;
      image.data[i + 2] = 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function getLogicalSize(parsed) {
  const descriptor = parsed.lsd || parsed.logicalScreenDescriptor || {};
  return {
    width: Number(descriptor.width || descriptor.logicalScreenWidth || 0),
    height: Number(descriptor.height || descriptor.logicalScreenHeight || 0)
  };
}

function initialCrop(source) {
  if (source.width === 720 && source.height === 1280) return { ...DEFAULT_CROP };
  return { x: 0, y: 0, width: source.width, height: source.height };
}

function getDisposal(frame) {
  return Number(frame.disposalType ?? frame.disposal ?? frame.gce?.disposalType ?? frame.gce?.extras?.disposal ?? 0);
}

function frameDelay(frame) {
  return Math.max(20, Number(frame.delay) || 100);
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
    if (nextDistance < distance) { distance = nextDistance; closest = frame; }
    frame.classList.remove('active');
  });
  closest?.classList.add('active');
}

function updateReductionMetric() {
  if (!state.file) return el.reductionMetric.textContent = '—';
  const target = Math.max(0, Math.round((1 - state.maxBytes / state.file.size) * 100));
  el.reductionMetric.textContent = state.file.size > state.maxBytes ? `${target}% or more` : 'Already below limit';
  el.exportLabel.textContent = `Export < ${formatBytes(state.maxBytes)}`;
}

function setZoom(value) {
  state.zoom = Math.min(150, Math.max(50, value));
  el.canvasStage.style.width = `min(${Math.round(512 * state.zoom / 100)}px, 80vw)`;
  el.zoomLabel.textContent = `${state.zoom}%`;
}

function resetApp() {
  stopPlayback();
  if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
  Object.assign(state, { file: null, parsed: null, frames: [], currentFrame: 0, previewCompositor: null, outputUrl: null });
  el.fileInput.value = '';
  el.editor.classList.add('hidden');
  el.emptyView.classList.remove('hidden');
  el.newButton.classList.add('hidden');
  el.exportButton.disabled = true;
  el.fileName.textContent = 'No file open';
  el.timelineStrip.replaceChildren();
}

function setBusy(busy, title = '', message = '', progress = 0) {
  state.busy = busy;
  el.progress.classList.toggle('hidden', !busy);
  if (busy) setProgress(title, message, progress);
}

function setProgress(title, message, progress) {
  el.progressTitle.textContent = title;
  el.progressText.textContent = message;
  el.progressBar.style.width = `${progress}%`;
}

let toastTimer;
function showToast(message, error = false) {
  window.clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.toggle('error', error);
  el.toast.classList.remove('hidden');
  toastTimer = window.setTimeout(() => el.toast.classList.add('hidden'), 5000);
}

function numberField(id, label, value) {
  return `<div class="field"><label for="${id}">${label}</label><div class="input-wrap"><input id="${id}" type="number" min="0" value="${value}"><span class="unit">px</span></div></div>`;
}

function clampNumber(value, min, max) { return Math.round(Math.min(max, Math.max(min, Number(value) || 0))); }
function formatBytes(bytes) { return bytes < 1_000_000 ? `${(bytes / 1000).toFixed(bytes < 100_000 ? 1 : 0)} KB` : `${(bytes / 1_000_000).toFixed(2)} MB`; }
function formatTime(ms) { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function nextPaint() { return new Promise((resolve) => requestAnimationFrame(() => resolve())); }
