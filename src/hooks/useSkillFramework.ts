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
