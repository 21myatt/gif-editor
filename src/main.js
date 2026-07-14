import { createActor } from 'xstate';
import { createEditorMachine, serializeEditorSnapshot } from './machine/editorMachine.js';
import { createGifEncoder } from './services/encodeGif.js';
import { bindEditorEvents } from './ui/events.js';
import { createRenderer } from './ui/render.js';
import { collectElements, renderTemplate } from './ui/template.js';
import './style.css';

const app = document.querySelector('#app');

renderTemplate(app);

const el = collectElements();
const renderer = createRenderer({ el });
const encodeGif = createGifEncoder({
  onProgress: (update) => renderer.setProgress(
    update.title || el.progressTitle.textContent,
    update.message || el.progressText.textContent,
    update.progress ?? (Number.parseFloat(el.progressBar.style.width) || 0)
  )
});
const editor = createActor(createEditorMachine({ encodeGif }));

let previousSnapshot = null;
let state = editor.getSnapshot().context;

renderer.attachActor(editor);
bindEditorEvents({
  el,
  editor,
  getState: () => state,
  onSpriteSheetExport: renderer.openSpriteSheetDialog,
  onSpriteSheetPreview: renderer.previewSpriteSheet,
  onSpriteSheetDownload: renderer.downloadSpriteSheet,
  onSpriteSheetCancel: renderer.closeSpriteSheetDialog
});
window.FramecutDebug = {
  snapshot: () => serializeEditorSnapshot(editor.getSnapshot())
};

editor.subscribe((snapshot) => {
  const previous = previousSnapshot;
  previousSnapshot = snapshot;
  state = snapshot.context;
  renderer.renderFromSnapshot(snapshot, previous);
});

editor.start();
