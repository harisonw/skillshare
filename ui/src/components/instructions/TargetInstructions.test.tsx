import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import type { TargetInstructions as Data } from '../../api/client';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../Toast';
import TargetInstructions from './TargetInstructions';

vi.mock('../CodeEditor', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) => <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock('../../api/client', async (load) => {
  const actual = await load<typeof import('../../api/client')>();
  return { ...actual, api: { ...actual.api, getTargetInstructions: vi.fn(), putTargetInstructions: vi.fn().mockResolvedValue({ success: true }) } };
});

const file = (target: string, path: string, extra: Partial<Data> = {}): Data => ({
  target, project: false, supported: true, custom: false, path, exists: true, content: `${target} file\n`, size: 10, import: false,
  read_order: [{ path, kind: 'main', exists: true, read: true }], import_lines: [], shared: [], convert: [], riders: [], read_by: [], ...extra,
});

// The tool is picked from the file list beside the panel.
const pickTool = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  const list = await screen.findByRole('navigation', { name: 'Files on this page' });
  await user.click(within(list).getByRole('button', { name }));
};

// A data router, as the app uses: the editor guards unsaved edits with useBlocker.
const renderAt = (name: string) => {
  const router = createMemoryRouter([{
    path: '*',
    element: (
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider><ToastProvider><TargetInstructions name={name} /></ToastProvider></I18nProvider>
      </QueryClientProvider>
    ),
  }], { initialEntries: [`/targets/${name}?tab=instructions`] });
  render(<RouterProvider router={router} />);
  return router;
};
const renderTarget = (name: string) => renderAt(name);

const renderUniversal = () => {
  vi.mocked(api.getTargetInstructions).mockImplementation(async (name) => name === 'codex'
    ? file('codex', '~/.codex/AGENTS.md', { rider_of: 'universal' })
    : file('universal', '~/.agents/AGENTS.md', { riders: [{ name: 'codex', path: '~/.codex/AGENTS.md', exists: true }], read_by: ['cline', 'warp'] }));
  return renderAt('universal');
};

describe('Target instructions tab', () => {
  // jsdom has no scrollIntoView, which the dropdown calls on its focused option.
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(api.putTargetInstructions).mockClear();
  });

  // Codex reads skills from ~/.agents/skills but its own ~/.codex/AGENTS.md, so universal offers it.
  it('switches from universal to the file of a tool that reads its skills', async () => {
    renderUniversal();
    const user = userEvent.setup();

    await pickTool(user, /Codex/);
    await waitFor(() => expect(api.getTargetInstructions).toHaveBeenCalledWith('codex'));
  });

  it('asks before switching away from an unsaved edit and keeps it on cancel', async () => {
    renderUniversal();
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'AGENTS.md' }), 'draft');
    await pickTool(user, /Codex/);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('textbox', { name: 'AGENTS.md' })).toHaveValue('universal file\ndraft');
  });

  // Built-in targets can move their file too; the form starts from the file in use.
  it('changes the location of a built-in target starting from its current file', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('codex', '~/.codex/AGENTS.md', { default_path: '~/.codex/AGENTS.md' }));
    renderTarget('codex');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change location' }));

    expect(screen.getByRole('textbox', { name: 'File location' })).toHaveValue('~/.codex/AGENTS.md');
  });

  it('offers going back to the default only when a location is set', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('codex', '~/.codex/instructions.md', {
      default_path: '~/.codex/AGENTS.md', custom: true, setup: { path: '~/.codex/instructions.md' },
    }));
    renderTarget('codex');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change location' }));

    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeInTheDocument();
  });

  it('opens the location form in a dialog', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('codex', '~/.codex/AGENTS.md', { default_path: '~/.codex/AGENTS.md' }));
    renderTarget('codex');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change location' }));

    expect(screen.getByRole('dialog', { name: 'Which file codex reads' })).toBeInTheDocument();
  });

  // The read order and the shared file sit on one line above the editor.
  it('says which files a target does not read and which shared file it uses', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('claude', '~/.claude/CLAUDE.md', {
      import: true,
      read_order: [{ path: '~/.claude/CLAUDE.md', kind: 'main', exists: true, read: true }, { path: '~/.claude/AGENTS.md', kind: 'unread', exists: false, read: false }],
      shared: [{ name: 'personal', mode: 'import', status: 'synced' }],
    }));
    renderTarget('claude');

    expect(await screen.findByText("Doesn't read a user-level AGENTS.md")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'personal' })).toHaveAttribute('href', '/extras?tab=instructions&file=personal');
  });

  it('keeps an unsaved edit when switching to preview and back', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('codex', '~/.codex/AGENTS.md'));
    renderTarget('codex');
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'AGENTS.md' }), 'draft');
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    await user.click(screen.getByRole('tab', { name: 'Edit' }));

    expect(screen.getByRole('textbox', { name: 'AGENTS.md' })).toHaveValue('codex file\ndraft');
  });

  // read_by moved from a note above the panel into the read-order line.
  it('says which other tools read the same file', async () => {
    renderUniversal();

    expect(await screen.findByText('Cline, Warp also read this file')).toBeInTheDocument();
  });

  it('does not save the page editor with Cmd+S while a dialog is open over it', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('codex', '~/.codex/AGENTS.md', { default_path: '~/.codex/AGENTS.md' }));
    renderTarget('codex');
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'AGENTS.md' }), 'draft');
    await user.click(screen.getByRole('button', { name: 'Change location' }));
    fireEvent.keyDown(document.body, { key: 's', metaKey: true });

    expect(api.putTargetInstructions).not.toHaveBeenCalled();
  });

  it('asks before leaving the page with an unsaved edit', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('codex', '~/.codex/AGENTS.md'));
    const router = renderTarget('codex');
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'AGENTS.md' }), 'draft');
    act(() => { void router.navigate('/skills'); });

    expect(await screen.findByRole('dialog', { name: 'Unsaved Changes' })).toBeInTheDocument();
  });

  it('leaves without asking when nothing is unsaved', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('codex', '~/.codex/AGENTS.md'));
    const router = renderTarget('codex');

    await screen.findByRole('textbox', { name: 'AGENTS.md' });
    act(() => { void router.navigate('/skills'); });

    await waitFor(() => expect(router.state.location.pathname).toBe('/skills'));
  });

  it('cannot change the location while a shared file is connected', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('claude', '~/.claude/CLAUDE.md', {
      import: true, default_path: '~/.claude/CLAUDE.md', shared: [{ name: 'personal', mode: 'import', status: 'synced' }],
    }));
    renderTarget('claude');

    expect(await screen.findByRole('button', { name: 'Change location' })).toBeDisabled();
  });

  it('saves with Cmd+S from the Preview tab', async () => {
    vi.mocked(api.getTargetInstructions).mockResolvedValue(file('codex', '~/.codex/AGENTS.md'));
    renderTarget('codex');
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'AGENTS.md' }), 'draft');
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    fireEvent.keyDown(document.body, { key: 's', metaKey: true });

    await waitFor(() => expect(api.putTargetInstructions).toHaveBeenCalledWith('codex', 'codex file\ndraft'));
  });
});

it('shows the file name for a Windows instruction path', async () => {
  vi.mocked(api.getTargetInstructions).mockResolvedValue(file('claude', String.raw`C:\Users\Public\sstest\manual\.claude\CLAUDE.md`));
  renderTarget('claude');
  expect(await screen.findByRole('textbox', { name: 'CLAUDE.md' })).toBeInTheDocument();
});
