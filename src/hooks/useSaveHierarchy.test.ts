import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildSavePayload } from './useSaveHierarchy';
import { loadSkillFramework } from './useSkillFramework';
import { getCompetencyFramework } from '../api/competencyFramework';
import { queryClient } from '../queryClient';

vi.mock('../api/competencyFramework', () => ({
  getCompetencyFramework: vi.fn(),
  listCompetencyFrameworks: vi.fn(async () => []),
}));
import type { INode } from '../types/editor';

// Active framework BMGS's deepest category is `topic`; a cached USF makes `skill` a known code from another framework.
const root: INode = { id: 'do_root', identifier: 'do_root', name: 'Set', children: [] } as INode;
const rootMeta = (primaryCategory: string, cache: Record<string, unknown>) =>
  (buildSavePayload([root], { do_root: cache }, 'ch', primaryCategory).nodesModified.do_root as { metadata: Record<string, unknown> }).metadata;

describe('buildSavePayload taxonomy cleanup', () => {
  beforeEach(() => {
    queryClient.setQueryData(['framework', 'BMGS'], { identifier: 'BMGS', categories: [{ code: 'board', index: 1 }, { code: 'topic', index: 2 }] });
    queryClient.setQueryData(['framework', 'USF'], { identifier: 'USF', categories: [{ code: 'skill', index: 1 }] });
  });
  afterEach(() => queryClient.clear());

  it("keeps a Dynamic QuestionSet's selected skills, which live in the active framework's deepest category (positive)", () => {
    expect(rootMeta('Dynamic QuestionSet', { framework: 'BMGS', topic: ['Algebra'] }).topic).toEqual(['Algebra']);
  });

  it('clears a category from another framework the same way for Dynamic and other sets (negative)', () => {
    expect(rootMeta('Dynamic QuestionSet', { framework: 'BMGS', skill: ['Old'] }).skill).toEqual([]);
    expect(rootMeta('Practice Question Set', { framework: 'BMGS', skill: ['Old'] }).skill).toEqual([]);
  });
});

// The set's skill framework `agro` stores its skills under `skill`, which USF also uses as a category.
describe("buildSavePayload keeps the set's skills out of the taxonomy cleanup", () => {
  const agro = { categories: [{ code: 'skill', index: 1, terms: [{ code: 'crop-survey', name: 'Crop Survey' }] }] };
  const setCache = { framework: 'BMGS', competencyFramework: 'agro', skill: ['crop-survey'], domain: ['Old'] };

  beforeEach(() => {
    queryClient.setQueryData(['framework', 'BMGS'], { identifier: 'BMGS', categories: [{ code: 'board', index: 1 }, { code: 'topic', index: 2 }] });
    queryClient.setQueryData(['framework', 'USF'], { identifier: 'USF', categories: [{ code: 'skill', index: 1 }, { code: 'domain', index: 2 }] });
    vi.mocked(getCompetencyFramework).mockReset();
  });
  afterEach(() => queryClient.clear());

  it('keeps them, and clears other stale categories, once the skill framework is loaded (positive)', async () => {
    vi.mocked(getCompetencyFramework).mockResolvedValue(agro as never);
    expect(await loadSkillFramework('agro')).toBe(true);
    const meta = rootMeta('Practice Question Set', setCache);
    expect(meta.skill).toEqual(['crop-survey']);
    expect(meta.domain).toEqual([]);
  });

  it('keeps them when the skill framework is not in the cache, by skipping the cleanup (negative)', () => {
    const meta = rootMeta('Practice Question Set', setCache);
    expect(meta.skill).toEqual(['crop-survey']);
    expect(meta.domain).toEqual(['Old']);
  });

  it('reports a skill framework that cannot be read, leaving the cleanup skipped (negative)', async () => {
    vi.mocked(getCompetencyFramework).mockRejectedValue(new Error('network'));
    expect(await loadSkillFramework('agro')).toBe(false);
    expect(rootMeta('Practice Question Set', setCache).skill).toEqual(['crop-survey']);
  });
});
