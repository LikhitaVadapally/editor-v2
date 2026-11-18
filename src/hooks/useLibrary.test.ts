import { describe, it, expect } from 'vitest';
import { buildSetLibraryFilters, otherQuestionsTotal, selectOtherQuestions, setLibraryHint } from './useLibrary';
import type { IContent } from '../types/content';

const q = (identifier: string, extra: Record<string, unknown> = {}) => ({ identifier, name: identifier, ...extra }) as unknown as IContent;

describe('buildSetLibraryFilters', () => {
  it('matches the set\'s skill framework and any of its skills under the framework\'s own field (positive)', () => {
    expect(buildSetLibraryFilters('agro', 'skill', ['crop-rotation-planning', 'soil-testing'])).toEqual({
      competencyFramework: ['agro'],
      skill: ['crop-rotation-planning', 'soil-testing'],
    });
  });

  it('uses whatever field the framework stores skills in (positive)', () => {
    expect(buildSetLibraryFilters('culinary_test', 'cuisine', ['cuisine-french'])).toEqual({
      competencyFramework: ['culinary_test'],
      cuisine: ['cuisine-french'],
    });
  });
});

describe('selectOtherQuestions', () => {
  const skills = ['crop-rotation-planning'];

  it('keeps questions without the set\'s skills (positive)', () => {
    const others = [q('a'), q('b', { competencyFramework: 'agro', skill: ['soil-testing'] })];
    expect(selectOtherQuestions(others, new Set(), 'agro', 'skill', skills).map((i) => i.identifier)).toEqual(['a', 'b']);
  });

  it('drops questions already in the matching list (negative)', () => {
    expect(selectOtherQuestions([q('a'), q('b')], new Set(['a']), 'agro', 'skill', skills).map((i) => i.identifier)).toEqual(['b']);
  });

  it('drops questions that carry one of the set\'s skills, even when not on the first page (negative)', () => {
    const tagged = q('t', { competencyFramework: 'agro', skill: ['crop-rotation-planning'] });
    expect(selectOtherQuestions([tagged], new Set(), 'agro', 'skill', skills)).toEqual([]);
  });

  it('keeps a question with the same skill code under another framework (positive)', () => {
    const elsewhere = q('e', { competencyFramework: 'other_fw', skill: ['crop-rotation-planning'] });
    expect(selectOtherQuestions([elsewhere], new Set(), 'agro', 'skill', skills)).toEqual([elsewhere]);
  });
});

describe('setLibraryHint', () => {
  it('asks for the set\'s skills when it has none and frameworks exist (positive)', () => {
    expect(setLibraryHint({ ready: false, hasFrameworks: true })).toBe('pickSkills');
  });

  it('stays quiet once skills are set, or when the channel has no skill frameworks (negative)', () => {
    expect(setLibraryHint({ ready: true, hasFrameworks: true })).toBeNull();
    expect(setLibraryHint({ ready: false, hasFrameworks: false })).toBeNull();
  });
});

describe('otherQuestionsTotal', () => {
  it('counts every other question, not just a loaded page: the plain browse less the matches (positive)', () => {
    // ed-dev, "cuisine q test": 341 Live questions, 2 tagged with the set's skills.
    expect(otherQuestionsTotal(341, 2)).toBe(339);
  });

  it('never goes below zero (negative)', () => {
    expect(otherQuestionsTotal(1, 3)).toBe(0);
    expect(otherQuestionsTotal(0, 0)).toBe(0);
  });
});
