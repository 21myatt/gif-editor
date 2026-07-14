export const PROJECT_FILE_VERSION = 1;

export async function createProjectFile(context) {
  if (!context.file) throw new Error('Open a GIF before saving.');
  return {
    version: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    source: {
      name: context.file.name,
      type: context.file.type || 'image/gif',
      lastModified: context.file.lastModified || null,
      data: await blobToDataUrl(context.file)
    },
    editor: {
      crop: context.crop,
      outputEdge: context.outputEdge,
      maxBytes: context.maxBytes,
      frameRange: context.frameRange,
      speed: context.speed,
      paletteMode: context.paletteMode,
      alphaEnabled: context.alphaEnabled,
      matteColor: context.matteColor,
      timelineMode: context.timelineMode,
      filters: context.filters,
      flipX: context.flipX,
      flipY: context.flipY,
      currentFrame: context.currentFrame,
      zoom: context.zoom
    }
  };
}

export async function parseProjectFile(file) {
  const project = JSON.parse(await file.text());
  if (project.version !== PROJECT_FILE_VERSION) throw new Error('Unsupported GIFor project version.');
  if (!project.source?.data || !project.source?.name || !project.editor) throw new Error('Invalid GIFor project file.');
  const sourceFile = dataUrlToFile(project.source.data, project.source.name, project.source.type || 'image/gif', project.source.lastModified);
  return { sourceFile, editor: project.editor };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error || new Error('Could not read project source GIF.')));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToFile(dataUrl, name, type, lastModified) {
  const [header, payload] = dataUrl.split(',');
  if (!header?.startsWith('data:') || !payload) throw new Error('Project source GIF is invalid.');
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], name, { type, lastModified: lastModified || Date.now() });
}
