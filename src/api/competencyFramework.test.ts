import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient, setApiBaseUrl, setApiSlug } from './client';
import { listCompetencyFrameworks } from './competencyFramework';

// The X-Channel-Id header doesn't narrow composite search, so the channel must be a filter,
// or every channel's skill frameworks are offered.
describe('listCompetencyFrameworks', () => {
  const captured: InternalAxiosRequestConfig[] = [];

  beforeEach(() => {
    setApiBaseUrl('');
    setApiSlug('/api');
    captured.length = 0;
    apiClient.defaults.adapter = async (config) => {
      captured.push(config);
      return {
        data: { result: { CompetencyFramework: [{ identifier: 'culinary_test', name: 'Culinary Test' }, { identifier: 'agro' }] } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    };
  });

  afterEach(() => {
    apiClient.defaults.adapter = undefined;
  });

  const filters = () => JSON.parse(captured[0]!.data as string).request.filters;

  it("filters by the channel and falls back to the id when a framework has no name", async () => {
    const list = await listCompetencyFrameworks('ch_1');
    expect(filters()).toEqual({ objectType: ['CompetencyFramework'], status: ['Live'], channel: ['ch_1'] });
    expect(list).toEqual([
      { identifier: 'culinary_test', name: 'Culinary Test' },
      { identifier: 'agro', name: 'agro' },
    ]);
  });

  it('adds no channel filter when the channel is unknown', async () => {
    await listCompetencyFrameworks();
    expect(filters()).not.toHaveProperty('channel');
  });
});
