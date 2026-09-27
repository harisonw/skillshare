import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { pluginsApi } from './plugins';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

describe('pluginsApi.list', () => {
  it('reads a null installed list as empty', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      packages: {},
      hosts: [{ target: 'opencode', version: '1.18.32', status: 'blocked', error: 'both opencode.json and opencode.jsonc exist', installed: null }],
    });
    const inv = await pluginsApi.list();
    expect(inv.hosts[0].installed).toEqual([]);
  });
});
