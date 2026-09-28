import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../api/client';
import { I18nProvider } from '../../i18n';
import AddLocationDialog from './AddLocationDialog';

vi.mock('../../api/client', async (load) => {
  const actual = await load<typeof import('../../api/client')>();
  return { ...actual, api: { ...actual.api, addInstructionLocation: vi.fn() } };
});

const renderDialog = (fileLinks = true, onAdded = vi.fn(), project = false) => {
  render(<I18nProvider><AddLocationDialog name="personal" file="AGENTS.md" fileLinks={fileLinks} project={project} onClose={() => {}} onAdded={onAdded} /></I18nProvider>);
  return onAdded;
};

describe('Add location dialog', () => {
  beforeEach(() => {
    vi.mocked(api.addInstructionLocation).mockReset();
  });

  // A tool that does not read @import would only see a path line.
  it('keeps import off until the reader is said to support @import', async () => {
    renderDialog();
    const user = userEvent.setup();
    const importRadio = screen.getByRole('radio', { name: /^import/ });
    expect(importRadio).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /supports @import/ }));

    expect(importRadio).toBeEnabled();
  });

  it('offers copy instead of symlink when file links are unavailable', () => {
    renderDialog(false);

    expect(screen.getByRole('radio', { name: /^symlink/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /^copy/ })).toBeChecked();
  });

  it('sends the folder, file name and mode', async () => {
    vi.mocked(api.addInstructionLocation).mockResolvedValue({ success: true });
    const onAdded = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Folder' }), '~/work/notes');
    await user.type(screen.getByRole('textbox', { name: 'File name' }), 'instructions.md');
    await user.click(screen.getByRole('button', { name: 'Add and sync' }));

    expect(api.addInstructionLocation).toHaveBeenCalledWith('personal', { path: '~/work/notes', as: 'instructions.md', mode: 'symlink' });
    expect(onAdded).toHaveBeenCalledWith('~/work/notes/instructions.md', undefined);
  });

  it('shows a refusal inside the dialog', async () => {
    vi.mocked(api.addInstructionLocation).mockRejectedValue(new ApiError(409, 'is target', { code: 'instructions_location_is_target', params: { target: 'codex', path: '/h/.codex/AGENTS.md' } }));
    const onAdded = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Folder' }), '/h/.codex');
    await user.click(screen.getByRole('button', { name: 'Add and sync' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("/h/.codex/AGENTS.md is codex's file. Turn on codex in Targets above.");
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('puts a folder in the way under the file name', async () => {
    vi.mocked(api.addInstructionLocation).mockRejectedValue(new ApiError(409, 'directory', { code: 'instructions_location_directory', params: { path: '/h/notes/skills' } }));
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Folder' }), '/h/notes');
    await user.click(screen.getByRole('button', { name: 'Add and sync' }));

    expect(await screen.findByRole('textbox', { name: 'File name' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('takes a folder relative to the project root in a project', async () => {
    vi.mocked(api.addInstructionLocation).mockResolvedValue({ success: true });
    const onAdded = renderDialog(true, vi.fn(), true);
    const user = userEvent.setup();

    expect(screen.getByText('Relative to the project root (. for the root); created if missing.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Folder' }), 'docs/ai');
    await user.type(screen.getByRole('textbox', { name: 'File name' }), 'instructions.md');
    expect(screen.getByText('./docs/ai/instructions.md')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add and sync' }));

    expect(api.addInstructionLocation).toHaveBeenCalledWith('personal', { path: 'docs/ai', as: 'instructions.md', mode: 'symlink' });
    expect(onAdded).toHaveBeenCalledWith('./docs/ai/instructions.md', undefined);
  });
});
