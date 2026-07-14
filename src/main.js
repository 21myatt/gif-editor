import { createActor } from 'xstate';
import { createEditorMachine, serializeEditorSnapshot } from './machine/editorMachine.js';
import { createGifEncoder } from './services/encodeGif.js';
import { createProjectFile, parseProjectFile } from './services/projectFile.js';
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
let pendingProjectState = null;

renderer.attachActor(editor);
bindEditorEvents({
  el,
  editor,
  getState: () => state,
  onSpriteSheetExport: renderer.openSpriteSheetDialog,
  onSpriteSheetPreview: renderer.previewSpriteSheet,
  onSpriteSheetDownload: renderer.downloadSpriteSheet,
  onSpriteSheetCancel: renderer.closeSpriteSheetDialog,
  onSaveProject: saveProject,
  onOpenProject: () => el.projectInput.click(),
  onProjectFile: loadProject,
  onCopyErrorDetails: renderer.copyErrorDetails,
  onOpenShortcuts: renderer.openShortcutSheet,
  onCloseShortcuts: renderer.closeShortcutSheet,
  onToggleShortcuts: renderer.toggleShortcutSheet
});
window.GIForDebug = {
  snapshot: () => serializeEditorSnapshot(editor.getSnapshot())
};

editor.subscribe((snapshot) => {
  const previous = previousSnapshot;
  previousSnapshot = snapshot;
  state = snapshot.context;
  if (pendingProjectState && snapshot.matches('editing')) {
    editor.send({ type: 'APPLY_PROJECT_STATE', project: pendingProjectState });
    pendingProjectState = null;
  }
  renderer.renderFromSnapshot(snapshot, previous);
});

editor.start();

async function saveProject() {
  try {
    const project = await createProjectFile(editor.getSnapshot().context);
    downloadJson(project, `${project.source.name.replace(/\.gif$/i, '')}.gifor.json`);
  } catch (error) {
    console.error(error);
  }
}

async function loadProject(file) {
  try {
    const project = await parseProjectFile(file);
    pendingProjectState = project.editor;
    if (!editor.getSnapshot().can({ type: 'OPEN_GIF', file: project.sourceFile })) editor.send({ type: 'NEW' });
    queueMicrotask(() => editor.send({ type: 'OPEN_GIF', file: project.sourceFile }));
  } catch (error) {
    console.error(error);
  } finally {
    el.projectInput.value = '';
  }
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
