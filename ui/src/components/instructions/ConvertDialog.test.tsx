import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import type { Extra, SharedInstructionsFile, TargetInstructions } from '../../api/client';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../Toast';
import ConvertDialog from './ConvertDialog';

vi.mock('../../api/client', async (load) => {
  const actual = await load<typeof import('../../api/client')>();
  return {
    ...actual,
    api: { ...actual.api, listExtras: vi.fn(), listSharedInstructions: vi.fn(), convertTargetInstructions: vi.fn().mockResolvedValue({ changes: [] }) },
  };
});

const claude: TargetInstructions = {
  target: 'claude', project: false, supported: true, custom: false, path: '/h/.claude/CLAUDE.md', exists: true, content: '# Mine\n', size: 7, import: true,
  read_order: [], import_lines: [], shared: [], convert: ['import'], riders: [], read_by: [],
};

const withExtras = (extras: Partial<Extra>[]) => {
  vi.mocked(api.listExtras).mockResolvedValue({ extras: extras as Extra[] });
  vi.mocked(api.listSharedInstructions).mockResolvedValue({
    files: extras.filter((e) => e.file).map((e) => ({ name: e.name, file: 'AGENTS.md', path: `/h/extras/${e.name}/AGENTS.md`, chars: 1 }) as SharedInstructionsFile),
    targets: [],
    file_links: true,
  });
};

const renderDialog = (data = claude) => render(
  <QueryClientProvider client={new QueryClient()}>
    <I18nProvider><ToastProvider><ConvertDialog data={data} onClose={() => {}} /></ToastProvider></I18nProvider>
  </QueryClientProvider>,
);

describe('Convert dialog', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // Picking an existing file would append this target's rules to a file other targets read.
  it('starts with a new shared file, not an existing one', async () => {
    withExtras([{ name: 'personal', file: 'AGENTS.md' }]);
    renderDialog();

    expect(await screen.findByRole('combobox', { name: 'Shared AGENTS.md' })).toHaveTextContent('New one…');
  });

  it('asks only for a name when no other shared file can be picked', async () => {
    withExtras([{ name: 'personal', file: 'AGENTS.md' }]);
    renderDialog({ ...claude, shared: [{ name: 'personal' }] as TargetInstructions['shared'] });

    await screen.findByRole('textbox');
    expect(screen.queryByRole('combobox', { name: 'Shared AGENTS.md' })).not.toBeInTheDocument();
  });

  it('names the new shared file after the target', async () => {
    withExtras([{ name: 'personal', file: 'AGENTS.md' }]);
    renderDialog();

    expect(await screen.findByRole('textbox')).toHaveValue('claude');
  });

  it('shows why a taken name has no preview', async () => {
    withExtras([{ name: 'personal', file: 'AGENTS.md' }]);
    renderDialog();
    const user = userEvent.setup();

    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'personal');

    expect(screen.queryByText('Enter a name for the shared AGENTS.md to see the preview.')).not.toBeInTheDocument();
  });

  it('says when a name belongs to a folder extra', async () => {
    withExtras([{ name: 'personal', file: 'AGENTS.md' }, { name: 'claude-rules' }]);
    renderDialog();
    const user = userEvent.setup();

    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'claude-rules');

    expect(screen.getAllByText('claude-rules is already used by a folder extra. Pick another name.')).toHaveLength(2);
  });
});
