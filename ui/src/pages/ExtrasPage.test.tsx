import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/Toast';
import ExtrasPage from './ExtrasPage';

vi.mock('../context/AppContext', () => ({ useAppContext: () => ({ isProjectMode: true }) }));
vi.mock('../api/client', async (load) => {
  const actual = await load<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listExtras: vi.fn().mockResolvedValue({
        extras: [
          { name: 'team-rules', file: 'AGENTS.md', source_dir: '/p/.skillshare/extras/team-rules', source_type: 'per-extra', file_count: 1, source_exists: true,
            targets: [{ path: '.', mode: 'symlink', flatten: false, status: 'synced' }] },
          { name: 'rules', source_dir: '/p/.skillshare/extras/rules', source_type: 'per-extra', file_count: 2, source_exists: true,
            targets: [{ path: '.claude/rules', mode: 'merge', flatten: false, status: 'synced' }] },
        ],
      }),
      listExtraExtensions: vi.fn().mockResolvedValue({ extensions: [] }),
      availableTargets: vi.fn().mockResolvedValue({ targets: [] }),
      getOverview: vi.fn().mockResolvedValue({}),
    },
  };
});

describe('Extras page in a project', () => {
  // Shared files are on the AGENTS.md tab.
  it('lists only folder extras on the folders tab', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider><ToastProvider><MemoryRouter><ExtrasPage /></MemoryRouter></ToastProvider></I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('rules')).toBeInTheDocument();
    expect(screen.queryByText('team-rules')).not.toBeInTheDocument();
  });
});
