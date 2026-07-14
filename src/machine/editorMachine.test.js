import { createActor, waitFor } from 'xstate';
import { describe, expect, it, vi } from 'vitest';
import { appError, ErrorCode } from '../domain/errors.js';
import { createEditorMachine, serializeEditorSnapshot } from './editorMachine.js';

const decoded = {
  file: { name: 'sample.gif', size: 2_000_000 },
  parsed: {},
  source: { width: 320, height: 240 },
  frames: [{ delay: 100 }, { delay: 100 }],
  crop: { x: 0, y: 0, width: 320, height: 240 }
};

describe('editor machine', () => {
  it('moves through loading into parallel editing states', async () => {
    const actor = createTestActor();
    actor.send({ type: 'OPEN_GIF', file: decoded.file });
    await waitFor(actor, (snapshot) => snapshot.matches('buildingTimeline'));
    actor.send({ type: 'TIMELINE_READY' });

    expect(actor.getSnapshot().matches({ editing: { tool: 'crop', transport: 'paused' } })).toBe(true);
    expect(actor.getSnapshot().context.frames).toHaveLength(2);
  });

  it('models tool and playback changes as state transitions', async () => {
    const actor = await editingActor();
    actor.send({ type: 'SHOW_PREVIEW' });
    actor.send({ type: 'PLAY' });
    expect(actor.getSnapshot().matches({ editing: { tool: 'preview', transport: 'playing' } })).toBe(true);

    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().context.currentFrame).toBe(1);
    actor.send({ type: 'SEEK', index: 0 });
    expect(actor.getSnapshot().matches({ editing: { transport: 'paused' } })).toBe(true);
  });

  it('advances playback from a machine-owned timer', async () => {
    vi.useFakeTimers();
    try {
      const actor = await editingActor();
      actor.send({ type: 'PLAY' });

      await vi.advanceTimersByTimeAsync(100);

      expect(actor.getSnapshot().context.currentFrame).toBe(1);
      expect(actor.getSnapshot().matches({ editing: { transport: 'playing' } })).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('invokes export and returns its result to editing', async () => {
    const result = { blob: { size: 900_000 }, width: 320, height: 240 };
    const encodeGif = vi.fn().mockResolvedValue(result);
    const actor = await editingActor({ encodeGif });
    actor.send({ type: 'EXPORT' });
    await waitFor(actor, (snapshot) => snapshot.matches('editing') && snapshot.context.exportResult === result);

    expect(encodeGif).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context.exportResult).toBe(result);
  });

  it('allows sprite sheet setup only while editing', async () => {
    const actor = createTestActor();
    expect(actor.getSnapshot().can({ type: 'EXPORT_SPRITE_SHEET' })).toBe(false);

    actor.send({ type: 'OPEN_GIF', file: decoded.file });
    await waitFor(actor, (snapshot) => snapshot.matches('buildingTimeline'));
    actor.send({ type: 'TIMELINE_READY' });

    expect(actor.getSnapshot().can({ type: 'EXPORT_SPRITE_SHEET' })).toBe(true);
  });

  it('enters an explicit error state and recovers declaratively', async () => {
    const decodeGif = vi.fn().mockRejectedValue(appError(ErrorCode.INVALID_FILE, 'Choose a GIF file.', 'abort'));
    const actor = createTestActor({ decodeGif });
    actor.send({ type: 'OPEN_GIF', file: { name: 'bad.txt' } });
    await waitFor(actor, (snapshot) => snapshot.matches('error'));

    expect(actor.getSnapshot().context.error).toMatchObject({ code: ErrorCode.INVALID_FILE, recovery: 'abort' });
    actor.send({ type: 'ABORT' });
    expect(actor.getSnapshot().matches('empty')).toBe(true);
  });

  it('retries export errors by re-entering exporting', async () => {
    const result = { blob: { size: 900_000 }, width: 320, height: 240 };
    const encodeGif = vi
      .fn()
      .mockRejectedValueOnce(appError(ErrorCode.EXPORT_FAILED, 'Encoding failed.', 'retry'))
      .mockResolvedValueOnce(result);
    const actor = await editingActor({ encodeGif });

    actor.send({ type: 'EXPORT' });
    await waitFor(actor, (snapshot) => snapshot.matches('error'));
    actor.send({ type: 'RETRY' });
    await waitFor(actor, (snapshot) => snapshot.matches('editing') && snapshot.context.exportResult === result);

    expect(encodeGif).toHaveBeenCalledTimes(2);
  });

  it('aborts export errors back to editing without clearing the document', async () => {
    const encodeGif = vi.fn().mockRejectedValue(appError(ErrorCode.EXPORT_FAILED, 'Encoding failed.', 'retry'));
    const actor = await editingActor({ encodeGif });

    actor.send({ type: 'EXPORT' });
    await waitFor(actor, (snapshot) => snapshot.matches('error'));
    actor.send({ type: 'ABORT' });

    expect(actor.getSnapshot().matches('editing')).toBe(true);
    expect(actor.getSnapshot().context.frames).toHaveLength(2);
  });

  it('serializes snapshots without large frame patch payloads', async () => {
    const actor = await editingActor();
    const serialized = serializeEditorSnapshot(actor.getSnapshot());

    expect(serialized.value).toEqual({ editing: { tool: 'crop', transport: 'paused' } });
    expect(serialized.context.file).toEqual({ name: 'sample.gif', size: 2_000_000, type: undefined, lastModified: undefined });
    expect(serialized.context.frames[0]).toEqual({
      delay: 100,
      disposalType: 0,
      dims: null,
      patchBytes: 0
    });
  });
});

function createTestActor(overrides = {}) {
  const actor = createActor(createEditorMachine({
    decodeGif: overrides.decodeGif || vi.fn().mockResolvedValue(decoded),
    encodeGif: overrides.encodeGif || vi.fn().mockResolvedValue({ blob: { size: 1 }, width: 1, height: 1 })
  }));
  actor.start();
  return actor;
}

async function editingActor(overrides) {
  const actor = createTestActor(overrides);
  actor.send({ type: 'OPEN_GIF', file: decoded.file });
  await waitFor(actor, (snapshot) => snapshot.matches('buildingTimeline'));
  actor.send({ type: 'TIMELINE_READY' });
  return actor;
}
