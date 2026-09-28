import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useSaveShortcut } from '../../components/instructions/useSaveShortcut';
import { useGlobalShortcuts } from '../useGlobalShortcuts';

function Page({ onSync, onSave }: { onSync: () => void; onSave?: () => void }) {
  useGlobalShortcuts({ onToggleHelp: () => {}, onSync });
  return onSave ? <Editor onSave={onSave} /> : null;
}

function Editor({ onSave }: { onSave: () => void }) {
  useSaveShortcut(onSave);
  return null;
}

const pressSave = () => fireEvent.keyDown(document.body, { key: 's', metaKey: true });

describe('Cmd+S', () => {
  it('goes to Sync when no editor claims it', () => {
    const onSync = vi.fn();
    render(<MemoryRouter><Page onSync={onSync} /></MemoryRouter>);

    pressSave();

    expect(onSync).toHaveBeenCalledOnce();
  });

  it('saves in an open instruction editor instead of going to Sync', () => {
    const onSync = vi.fn();
    const onSave = vi.fn();
    render(<MemoryRouter><Page onSync={onSync} onSave={onSave} /></MemoryRouter>);

    pressSave();

    expect([onSave.mock.calls.length, onSync.mock.calls.length]).toEqual([1, 0]);
  });
});
