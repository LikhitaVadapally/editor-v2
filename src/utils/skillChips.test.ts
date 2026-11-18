import { describe, it, expect } from 'vitest';
import { questionSkillChips } from './skillChips';

const set = { frameworkId: 'agro', skillField: 'skill', skills: ['crop-survey'] };
const names = new Map([['crop-survey', 'Crop Survey'], ['crop-rotation-planning', 'Crop Rotation Planning']]);
const nameOf = (c: string) => names.get(c);

describe('questionSkillChips', () => {
  it("puts the set's own skills first, highlighted, by name (positive)", () => {
    const { chips, more } = questionSkillChips(
      { competencyFramework: 'agro', skill: ['crop-rotation-planning', 'crop-survey'] }, set, nameOf,
    );
    expect(chips).toEqual([
      { code: 'crop-survey', name: 'Crop Survey', matched: true },
      { code: 'crop-rotation-planning', name: 'Crop Rotation Planning', matched: false },
    ]);
    expect(more).toBe(0);
  });

  it('caps the chips and counts the rest (positive)', () => {
    const { chips, more } = questionSkillChips(
      { competencyFramework: 'agro', skill: ['a', 'b', 'c', 'd', 'e'] }, set, nameOf, 3,
    );
    expect(chips.map((c) => c.code)).toEqual(['a', 'b', 'c']);
    expect(more).toBe(2);
  });

  it('falls back to the code when a name is unknown, and takes a single stored code (positive)', () => {
    const { chips } = questionSkillChips({ competencyFramework: 'agro', skill: 'x' }, set, nameOf);
    expect(chips).toEqual([{ code: 'x', name: 'x', matched: false }]);
  });

  it("shows nothing for a question under another skill framework, or before the set's is known (negative)", () => {
    expect(questionSkillChips({ competencyFramework: 'culinary_test', skill: ['crop-survey'] }, set, nameOf).chips).toEqual([]);
    expect(questionSkillChips({ skill: ['crop-survey'] }, set, nameOf).chips).toEqual([]);
    expect(questionSkillChips({ competencyFramework: 'agro', skill: ['crop-survey'] }, { skills: [] }, nameOf).chips).toEqual([]);
  });
});
