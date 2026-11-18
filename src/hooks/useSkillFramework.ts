import { useQuery } from '@tanstack/react-query';
import { useTreeStore } from '../store/tree.store';
import { useEditorStore } from '../store/editor.store';
import { queryClient } from '../queryClient';
import { getCompetencyFramework, listCompetencyFrameworks, type ICompetencyFrameworkSummary } from '../api/competencyFramework';
import { competencyLeafSkills, competencySkillField, type CompetencySkill } from '../utils/competencyLeaves';

/** The metadata field a question set / question names its skill framework in (as lern reads it). */
export const SKILL_FRAMEWORK_FIELD = 'competencyFramework';

const NO_FRAMEWORKS: ICompetencyFrameworkSummary[] = [];
const NO_SKILLS: CompetencySkill[] = [];
const frameworkKey = (id: string | undefined) => ['competency-framework', id] as const;

/** The channel's Live skill frameworks - options for "Skill framework". */
export function useSkillFrameworkOptions(): ICompetencyFrameworkSummary[] {
  const channel = useEditorStore((s) => s.editorConfig?.context?.channel);
  const query = useQuery({
    queryKey: ['competency-frameworks', channel],
    queryFn: () => listCompetencyFrameworks(channel),
    staleTime: 10 * 60 * 1000,
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
  const query = useQuery({
    queryKey: frameworkKey(frameworkId),
    queryFn: () => getCompetencyFramework(frameworkId!),
    enabled: !!frameworkId,
    staleTime: 10 * 60 * 1000,
  });
  return {
    skills: query.data ? competencyLeafSkills(query.data.categories) : NO_SKILLS,
    skillField: query.data ? competencySkillField(query.data.categories) : undefined,
  };
}

/** The skill field of an already-loaded skill framework, for save-time (non-hook) code. */
export function cachedSkillField(frameworkId: string | undefined): string | undefined {
  if (!frameworkId) return undefined;
  const data = queryClient.getQueryData<{ categories?: Parameters<typeof competencySkillField>[0] }>(frameworkKey(frameworkId));
  return data ? competencySkillField(data.categories) : undefined;
}

/** The question set's skill framework; every question follows it. */
export function useSetSkillFramework(): string | undefined {
  return useTreeStore((s) => {
    const root = s.treeData[0];
    if (!root) return undefined;
    const v = s.treeCache[root.identifier]?.[SKILL_FRAMEWORK_FIELD] ?? root.metadata?.[SKILL_FRAMEWORK_FIELD];
    return typeof v === 'string' && v ? v : undefined;
  });
}

/** A stored skill value as a list of codes (a field may hold one code or a list). */
export const asCodes = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

/** The question set's skill framework, its skill field and the skills chosen on it. */
export interface SetSkills {
  frameworkId?: string;
  skillField?: string;
  skills: string[];
  /** A framework whose skills have loaded, and at least one skill chosen: the library can match on it. */
  ready: boolean;
}

/**
 * The set's skills from its root node, edits first (treeCache, keyed by identifier) then saved
 * metadata. `skillFieldOf` gives a framework's skill field, undefined until the framework loads.
 */
export function resolveSetSkills(
  root: { identifier: string; metadata?: Record<string, unknown> } | undefined,
  treeCache: Record<string, Record<string, unknown> | undefined>,
  skillFieldOf: (frameworkId: string) => string | undefined,
): SetSkills {
  if (!root) return { skills: [], ready: false };
  const meta = { ...(root.metadata ?? {}), ...(treeCache[root.identifier] ?? {}) } as Record<string, unknown>;
  const fw = meta[SKILL_FRAMEWORK_FIELD];
  const frameworkId = typeof fw === 'string' && fw ? fw : undefined;
  const skillField = frameworkId ? skillFieldOf(frameworkId) : undefined;
  const skills = skillField ? asCodes(meta[skillField]) : [];
  return { frameworkId, skillField, skills, ready: !!frameworkId && !!skillField && skills.length > 0 };
}

/** The set's skills right now, for code outside React (the library search). */
export function currentSetSkills(): SetSkills {
  const { treeData, treeCache } = useTreeStore.getState();
  return resolveSetSkills(
    treeData[0] as { identifier: string; metadata?: Record<string, unknown> } | undefined,
    treeCache as Record<string, Record<string, unknown> | undefined>,
    cachedSkillField,
  );
}

/** The set's skills, kept current; also loads the set's framework so its skill field is known. */
export function useSetSkills(): SetSkills {
  const frameworkId = useSetSkillFramework();
  const { skillField } = useSkillFrameworkSkills(frameworkId);
  // A string, so the selector result is stable between renders.
  const key = useTreeStore((s) => {
    const root = s.treeData[0];
    if (!root || !skillField) return '';
    const v = s.treeCache[root.identifier]?.[skillField] ?? root.metadata?.[skillField];
    return asCodes(v).join('\u0001');
  });
  const skills = key ? key.split('\u0001') : [];
  return { frameworkId, skillField, skills, ready: !!frameworkId && !!skillField && skills.length > 0 };
}
