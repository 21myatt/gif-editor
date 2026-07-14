import { createIcons, CircleHelp, Crop, Download, FilePlus2, FlipHorizontal2, FlipVertical2, Gauge, Images, Palette, Pause, Play, RotateCcw, Scaling, SkipBack, SkipForward, Upload, X, ZoomIn, ZoomOut } from 'lucide';

const iconSet = { Upload, Download, Crop, Scaling, FlipHorizontal2, FlipVertical2, Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, RotateCcw, FilePlus2, Gauge, X, Images, Palette, CircleHelp };

const elementIds = [
  'fileInput', 'dropZone', 'emptyView', 'editor', 'fileName', 'newButton', 'exportButton', 'exportLabel',
  'projectInput', 'saveProjectButton', 'openProjectButton', 'shortcutHelpButton',
  'cropX', 'cropY', 'cropWidth', 'cropHeight', 'resetCrop', 'cropModeButton', 'previewModeButton', 'cropOverlay', 'outputWidth', 'outputDimensions', 'flipX', 'flipY',
  'sizeLimit', 'sizeLimitText', 'reductionMetric', 'alphaToggle', 'matteColor', 'frameStart', 'frameEnd', 'speedControl', 'speedValue', 'paletteMode', 'spriteSheetButton', 'previewCanvas', 'canvasStage', 'stageBadge', 'zoomOut', 'zoomIn',
  'zoomLabel', 'firstFrame', 'playButton', 'lastFrame', 'timecode', 'frameCount', 'timelineModeButton', 'timelineStrip', 'progress',
  'progressTitle', 'progressText', 'progressBar', 'toast', 'errorDialog', 'errorTitle', 'errorMessage', 'errorDetails', 'copyErrorButton', 'retryButton', 'abortButton',
  'spriteDialog', 'spriteColumns', 'spriteRows', 'spritePreviewButton', 'spriteDownloadButton', 'spriteCancelButton', 'spritePreview', 'spriteMeta',
  'shortcutDialog', 'shortcutCloseButton'
];

export function renderTemplate(app) {
  app.innerHTML = `
    <div class="app">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">G</span><span>GIFor</span></div>
        <div id="fileName" class="file-name">No file open</div>
        <div class="header-actions">
          <button id="openProjectButton" class="button secondary" type="button"><i data-lucide="upload"></i><span class="button-label">Open</span></button>
          <button id="saveProjectButton" class="button secondary" type="button" disabled><i data-lucide="download"></i><span class="button-label">Save</span></button>
          <button id="newButton" class="button secondary hidden" type="button"><i data-lucide="file-plus-2"></i><span class="button-label">New</span></button>
          <button id="shortcutHelpButton" class="icon-button" type="button" title="Keyboard shortcuts"><i data-lucide="circle-help"></i></button>
          <button id="exportButton" class="button primary" type="button" disabled><i data-lucide="download"></i><span id="exportLabel" class="button-label">Export GIF</span></button>
          <input id="projectInput" type="file" accept="application/json,.json" hidden>
        </div>
      </header>

      <main id="emptyView" class="empty-view">
        <label id="dropZone" class="drop-zone" for="fileInput">
          <span class="drop-icon"><i data-lucide="upload"></i></span>
          <h1>Drop GIF</h1>
          <p>Crop, tune, export.</p>
          <span class="button">Choose GIF</span>
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
            <div class="metric"><span>Result</span><strong id="outputDimensions">512 x 356</strong></div>
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
            <div class="metric"><span>Target reduction</span><strong id="reductionMetric">-</strong></div>
            <label class="check-row" for="alphaToggle">
              <input id="alphaToggle" type="checkbox" checked>
              <span>Preserve alpha</span>
            </label>
            <div class="field full matte-field" style="margin-top:10px">
              <label for="matteColor"><i data-lucide="palette"></i> Matte color</label>
              <input id="matteColor" class="color-control" type="color" value="#ffffff">
            </div>
          </section>

          <section class="tool-group">
            <h2 class="group-title"><i data-lucide="skip-forward"></i> Frames</h2>
            <div class="field-grid">
              ${numberField('frameStart', 'Start', 1)}
              ${numberField('frameEnd', 'End', 1)}
            </div>
            <div class="field full" style="margin-top:14px">
              <label for="speedControl">Speed</label>
              <div class="range-row">
                <input id="speedControl" type="range" min="0.25" max="4" step="0.25" value="1">
                <strong id="speedValue" class="inline-value">1x</strong>
              </div>
            </div>
            <div class="field full" style="margin-top:14px">
              <label for="paletteMode">Palette</label>
              <select id="paletteMode" class="select-control">
                <option value="full">Full color</option>
                <option value="balanced">Balanced</option>
                <option value="compact">Compact</option>
              </select>
            </div>
            <button id="spriteSheetButton" class="button secondary" type="button" style="width:100%;margin-top:14px"><i data-lucide="download"></i>Export sprite sheet</button>
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
            <span id="stageBadge" class="stage-badge">512 x 356</span>
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
            <div class="transport-right">
              <button id="timelineModeButton" class="icon-button" type="button" title="Show sampled timeline"><i data-lucide="images"></i></button>
              <span id="frameCount" class="timecode">0 frames</span>
            </div>
          </div>
          <div id="timelineStrip" class="timeline-strip"></div>
        </section>
      </main>

      <div id="progress" class="progress hidden" role="status" aria-live="polite">
        <div class="progress-panel">
          <strong id="progressTitle">Preparing GIF</strong>
          <p id="progressText">Reading frames...</p>
          <div class="progress-track"><div id="progressBar" class="progress-bar"></div></div>
        </div>
      </div>
      <div id="errorDialog" class="error-dialog hidden" role="alertdialog" aria-modal="true" aria-labelledby="errorTitle" aria-describedby="errorMessage">
        <div class="error-panel">
          <strong id="errorTitle">Something went wrong</strong>
          <p id="errorMessage"></p>
          <pre id="errorDetails" class="error-details hidden"></pre>
          <div class="error-actions">
            <button id="copyErrorButton" class="button secondary" type="button">Copy details</button>
            <button id="abortButton" class="button secondary" type="button">Abort</button>
            <button id="retryButton" class="button primary" type="button">Retry</button>
          </div>
        </div>
      </div>
      <div id="shortcutDialog" class="shortcut-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="shortcutTitle">
        <div class="shortcut-panel">
          <div class="shortcut-header">
            <strong id="shortcutTitle">Keyboard shortcuts</strong>
            <button id="shortcutCloseButton" class="icon-button" type="button" title="Close shortcuts"><i data-lucide="x"></i></button>
          </div>
          <dl class="shortcut-list">
            <div><dt>Space</dt><dd>Play or pause</dd></div>
            <div><dt>Left / Right</dt><dd>Seek one frame</dd></div>
            <div><dt>Home / End</dt><dd>First or last frame</dd></div>
            <div><dt>?</dt><dd>Show or hide this sheet</dd></div>
          </dl>
        </div>
      </div>
      <div id="spriteDialog" class="sprite-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="spriteTitle">
        <div class="sprite-panel">
          <div class="sprite-header">
            <div>
              <strong id="spriteTitle">Sprite sheet</strong>
              <p>Set grid, preview, export PNG.</p>
            </div>
            <button id="spriteCancelButton" class="icon-button" type="button" title="Close"><i data-lucide="x"></i></button>
          </div>
          <div class="field-grid">
            ${numberField('spriteColumns', 'Columns', 4)}
            ${numberField('spriteRows', 'Rows', 4)}
          </div>
          <div class="sprite-preview-frame">
            <img id="spritePreview" alt="Sprite sheet preview">
            <span id="spriteMeta">Preview not generated</span>
          </div>
          <div class="sprite-actions">
            <button id="spritePreviewButton" class="button secondary" type="button">Preview</button>
            <button id="spriteDownloadButton" class="button primary" type="button" disabled><i data-lucide="download"></i>Download PNG</button>
          </div>
        </div>
      </div>
      <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>
    </div>`;

  createIcons({ icons: iconSet });
}

export function collectElements() {
  return Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));
}

export function refreshIcons(icons = iconSet) {
  createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
}

export { Pause, Play };

function numberField(id, label, value) {
  return `<div class="field"><label for="${id}">${label}</label><div class="input-wrap"><input id="${id}" type="number" min="0" value="${value}"><span class="unit">px</span></div></div>`;
}
