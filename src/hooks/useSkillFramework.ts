import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { useTreeStore } from '../store/tree.store';
import { useEditorStore } from '../store/editor.store';
import { queryClient } from '../queryClient';
import { getCompetencyFramework, listCompetencyFrameworks, type ICompetencyFrameworkSummary } from '../api/competencyFramework';
import { competencyLeafSkills, competencySkillField, type CompetencySkill } from '../utils/competencyLeaves';

/** The metadata field a question set / question names its skill framework in (as lern reads it). */
export const SKILL_FRAMEWORK_FIELD = 'competencyFramework';

const SKILL_FRAMEWORK_STALE_MS = 10 * 60 * 1000;
const NO_FRAMEWORKS: ICompetencyFrameworkSummary[] = [];
const NO_SKILLS: CompetencySkill[] = [];
const NO_CODES: string[] = [];

/** One query definition, so the hook, the cache lookup and the save-time load all share it. */
const skillFrameworkQuery = (frameworkId: string) => ({
  queryKey: ['competency-framework', frameworkId] as const,
  queryFn: () => getCompetencyFramework(frameworkId),
  staleTime: SKILL_FRAMEWORK_STALE_MS,
});

/** The channel's Live skill frameworks - options for "Skill framework". */
export function useSkillFrameworkOptions(): ICompetencyFrameworkSummary[] {
  const channel = useEditorStore((s) => s.editorConfig?.context?.channel);
  const query = useQuery({
    queryKey: ['competency-frameworks', channel],
    queryFn: () => listCompetencyFrameworks(channel),
    staleTime: SKILL_FRAMEWORK_STALE_MS,
  });
  return query.data ?? NO_FRAMEWORKS;
}

/**
 * One skill framework's skills (its last category's terms) and `skillField`, the field they are
 * saved in (that category's code: `skill`, `cuisine`, ...) - the rule lern reads them by.
 */
export function useSkillFrameworkSkills(frameworkId: string | undefined): {
  skills: CompetencySkill[];
  skillField: string | undefined;
} {
  const query = useQuery({ ...skillFrameworkQuery(frameworkId ?? ''), enabled: !!frameworkId });
  return {
    skills: query.data ? competencyLeafSkills(query.data.categories) : NO_SKILLS,
    skillField: query.data ? competencySkillField(query.data.categories) : undefined,
  };
}

/**
 * The skill field of a skill framework already in the query cache. The cache drops a framework no
 * component has used for a while, so code that writes data calls `loadSkillFramework` first.
 */
export function cachedSkillField(frameworkId: string | undefined): string | undefined {
  if (!frameworkId) return undefined;
  const data = queryClient.getQueryData<{ categories?: Parameters<typeof competencySkillField>[0] }>(
    skillFrameworkQuery(frameworkId).queryKey,
  );
  return data ? competencySkillField(data.categories) : undefined;
}

/**
 * Loads a skill framework into the query cache if it isn't there, so `cachedSkillField` can answer.
 * Resolves false when it can't be read; callers then leave the skill field alone rather than guess.
 */
export async function loadSkillFramework(frameworkId: string | undefined): Promise<boolean> {
  if (!frameworkId) return true;
  try {
    await queryClient.ensureQueryData(skillFrameworkQuery(frameworkId));
    return true;
  } catch {
    return false;
  }
}

/** A stored skill value as a list of codes (a field may hold one code or a list). */
export const asCodes = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

type RootNode = { identifier: string; metadata?: Record<string, unknown> };

/** The set's root metadata with unsaved edits applied (treeCache is keyed by identifier). */
function rootMeta(
  root: RootNode | undefined,
  treeCache: Record<string, Record<string, unknown> | undefined>,
): Record<string, unknown> | undefined {
  return root ? { ...(root.metadata ?? {}), ...(treeCache[root.identifier] ?? {}) } : undefined;
}

function frameworkOf(meta: Record<string, unknown> | undefined): string | undefined {
  const fw = meta?.[SKILL_FRAMEWORK_FIELD];
  return typeof fw === 'string' && fw ? fw : undefined;
}

/** The question set's skill framework; every question follows it. */
export function useSetSkillFramework(): string | undefined {
  return useTreeStore((s) => frameworkOf(rootMeta(s.treeData[0] as RootNode | undefined, s.treeCache)));
}

/** The question set's skill framework, its skill field and the skills chosen on it. */
export interface SetSkills {
  frameworkId?: string;
  skillField?: string;
  skills: string[];
  /** A framework whose skills have loaded, and at least one skill chosen: the library can match on it. */
  ready: boolean;
}

function setSkills(frameworkId: string | undefined, skillField: string | undefined, skills: string[]): SetSkills {
  return { frameworkId, skillField, skills, ready: !!frameworkId && !!skillField && skills.length > 0 };
}

/**
 * The set's skills from its root node, edits first then saved metadata. `skillFieldOf` gives a
 * framework's skill field, undefined until the framework loads.
 */
export function resolveSetSkills(
  root: RootNode | undefined,
  treeCache: Record<string, Record<string, unknown> | undefined>,
  skillFieldOf: (frameworkId: string) => string | undefined,
): SetSkills {
  const meta = rootMeta(root, treeCache);
  const frameworkId = frameworkOf(meta);
  const skillField = frameworkId ? skillFieldOf(frameworkId) : undefined;
  return setSkills(frameworkId, skillField, skillField ? asCodes(meta?.[skillField]) : []);
}

/** The set's skills right now, for code outside React (the library search). */
export function currentSetSkills(): SetSkills {
  const { treeData, treeCache } = useTreeStore.getState();
  return resolveSetSkills(
    treeData[0] as RootNode | undefined,
    treeCache as Record<string, Record<string, unknown> | undefined>,
    cachedSkillField,
  );
}

/** The set's skills, kept current; also loads the set's framework so its skill field is known. */
export function useSetSkills(): SetSkills {
  const frameworkId = useSetSkillFramework();
  const { skillField } = useSkillFrameworkSkills(frameworkId);
  const skills = useTreeStore(useShallow((s) => {
    if (!skillField) return NO_CODES;
    return asCodes(rootMeta(s.treeData[0] as RootNode | undefined, s.treeCache)?.[skillField]);
  }));
  return setSkills(frameworkId, skillField, skills);
}
