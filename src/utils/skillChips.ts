import { SKILL_FRAMEWORK_FIELD, asCodes } from '../hooks/useSkillFramework';

export interface SkillChip {
  code: string;
  name: string;
  /** One of the question set's own skills. */
  matched: boolean;
}

/**
 * The skill chips for one library question: its skills under the set's skill framework, the set's
 * own skills first. A question tagged under another skill framework shows none - its codes mean
 * something else there. Codes resolve to names through `nameOf`, falling back to the code.
 */
export function questionSkillChips(
  item: Record<string, unknown>,
  set: { frameworkId?: string; skillField?: string; skills: string[] },
  nameOf: (code: string) => string | undefined,
  cap = 3,
): { chips: SkillChip[]; more: number } {
  if (!set.frameworkId || !set.skillField || item[SKILL_FRAMEWORK_FIELD] !== set.frameworkId) {
    return { chips: [], more: 0 };
  }
  const own = new Set(set.skills);
  const codes = [...new Set(asCodes(item[set.skillField]))];
  const ordered = [...codes.filter((c) => own.has(c)), ...codes.filter((c) => !own.has(c))];
  const all = ordered.map((code) => ({ code, name: nameOf(code) ?? code, matched: own.has(code) }));
  return { chips: all.slice(0, cap), more: Math.max(0, all.length - cap) };
}
