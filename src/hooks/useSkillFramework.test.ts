import { describe, it, expect, beforeEach } from 'vitest';
import { queryClient } from '../queryClient';
import { cachedSkillField, resolveSetSkills } from './useSkillFramework';

// Saves read the skill field from the already-loaded framework: the field is the framework's last
// category code, which is where a question's skill codes go (lern reads them there).
describe('cachedSkillField', () => {
  beforeEach(() => queryClient.clear());

  it('is the loaded framework\'s last category code', () => {
    queryClient.setQueryData(['competency-framework', 'culinary_test'], {
      categories: [
        { code: 'competencyarea', index: 1, terms: [] },
        { code: 'cuisine', index: 3, terms: [{ code: 'cuisine-french' }] },
        { code: 'competency', index: 2, terms: [] },
      ],
    });
    expect(cachedSkillField('culinary_test')).toBe('cuisine');
  });

  it('is undefined when no framework is set or it hasn\'t loaded', () => {
    expect(cachedSkillField(undefined)).toBeUndefined();
    expect(cachedSkillField('agro')).toBeUndefined();
  });
});

describe('resolveSetSkills', () => {
  const field = (fw: string) => (fw === 'agro' ? 'skill' : undefined);

  it('reads the set\'s framework and skills, edits over saved values (positive)', () => {
    const root = { identifier: 'qs1', metadata: { competencyFramework: 'agro', skill: ['old'] } };
    expect(resolveSetSkills(root, { qs1: { skill: ['crop-rotation-planning'] } }, field)).toEqual({
      frameworkId: 'agro', skillField: 'skill', skills: ['crop-rotation-planning'], ready: true,
    });
  });

  it('is not ready without skills, before the framework loads, or without a set (negative)', () => {
    expect(resolveSetSkills({ identifier: 'qs1', metadata: { competencyFramework: 'agro' } }, {}, field).ready).toBe(false);
    expect(resolveSetSkills({ identifier: 'qs1', metadata: { competencyFramework: 'x', skill: ['a'] } }, {}, field).ready).toBe(false);
    expect(resolveSetSkills(undefined, {}, field)).toEqual({ skills: [], ready: false });
  });
});
