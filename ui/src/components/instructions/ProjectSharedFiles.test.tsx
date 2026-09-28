import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import type { SharedInstructionsFile } from '../../api/client';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../Toast';
import ProjectSharedFiles from './ProjectSharedFiles';

vi.mock('../../api/client', async (load) => {
  const actual = await load<typeof import('../../api/client')>();
  return { ...actual, api: { ...actual.api, listSharedInstructions: vi.fn() } };
});

const teamRules: SharedInstructionsFile = {
  name: 'team-rules', file: 'AGENTS.md', path: '/p/.skillshare/extras/team-rules/AGENTS.md', exists: true, size: 1, chars: 1, targets: 0,
  locations: [
    { path: '.gemini', file: '/p/.gemini/GEMINI.md', as: 'GEMINI.md', mode: 'symlink', status: 'synced' },
    { path: '.', file: '/p/CLAUDE.md', as: 'CLAUDE.md', mode: 'import', status: 'synced' },
  ],
};

const renderSection = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <I18nProvider><ToastProvider><ProjectSharedFiles creating={false} setCreating={() => {}} /></ToastProvider></I18nProvider>
  </QueryClientProvider>,
);

describe('Project shared files', () => {
  beforeEach(() => {
    vi.mocked(api.listSharedInstructions).mockReset();
  });

  it('shows each shared file with its locations relative to the project', async () => {
    vi.mocked(api.listSharedInstructions).mockResolvedValue({ files: [teamRules], targets: [], file_links: true });
    renderSection();

    const card = await screen.findByRole('region', { name: 'team-rules' });
    expect(within(card).getByText('.skillshare/extras/team-rules/AGENTS.md')).toBeInTheDocument();
    expect(within(card).getByRole('combobox', { name: 'How ./.gemini/GEMINI.md gets team-rules' })).toHaveTextContent('symlink');
    expect(within(card).getByRole('combobox', { name: 'How ./CLAUDE.md gets team-rules' })).toHaveTextContent('import');
  });

  it('offers to create one when the project has none', async () => {
    vi.mocked(api.listSharedInstructions).mockResolvedValue({ files: [], targets: [], file_links: true });
    renderSection();

    expect(await screen.findByText('No shared files yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New shared file' })).toBeInTheDocument();
  });
});
