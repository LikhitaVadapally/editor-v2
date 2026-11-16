import { apiClient } from './client';
import { URLS } from './urls';
import type { CompetencyCategoryWire } from '../utils/competencyLeaves';

export interface ICompetencyFrameworkSummary {
  identifier: string;
  name: string;
}

/**
 * Live skill (competency) frameworks of the channel - `CompetencyFramework` objects, which never
 * appear in the curriculum Framework list. The channel is scoped by apiClient's X-Channel-Id header,
 * as for `searchFrameworks`.
 */
export async function listCompetencyFrameworks(): Promise<ICompetencyFrameworkSummary[]> {
  const response = await apiClient.post(URLS.composite.search, {
    request: {
      filters: { objectType: ['CompetencyFramework'], status: ['Live'] },
      fields: ['identifier', 'name'],
      limit: 100,
      sort_by: { name: 'asc' },
    },
  });
  const list = (response.data?.result?.CompetencyFramework ?? []) as ICompetencyFrameworkSummary[];
  return list.map((f) => ({ identifier: f.identifier, name: f.name || f.identifier }));
}

/** A skill framework with its categories and terms. */
export async function getCompetencyFramework(frameworkId: string): Promise<{ categories?: CompetencyCategoryWire[] }> {
  const response = await apiClient.get(`${URLS.competencyFramework.read}/${encodeURIComponent(frameworkId)}`);
  return (response.data?.result?.framework ?? {}) as { categories?: CompetencyCategoryWire[] };
}
