import React, { useMemo } from 'react';
import { useSetSkills, useSkillFrameworkSkills } from '../../hooks/useSkillFramework';
import { questionSkillChips } from '../../utils/skillChips';
import { useLabels } from '../../hooks/useLabels';
import type { IContent } from '../../types/content';

/**
 * A library question's skills under the set's skill framework, the set's own skills first and
 * highlighted. Renders nothing when the question carries none of that framework's skills.
 */
export const SkillChips: React.FC<{ item: IContent; cap?: number; className?: string }> = ({ item, cap = 3, className }) => {
  const L = useLabels();
  const set = useSetSkills();
  const { skills } = useSkillFrameworkSkills(set.frameworkId);
  const names = useMemo(() => new Map(skills.map((s) => [s.code, s.name])), [skills]);
  const { chips, more } = questionSkillChips(item, set, (c) => names.get(c), cap);
  if (!chips.length) return null;
  return (
    <div className={`ce-lib-skills${className ? ` ${className}` : ''}`} aria-label={L('ui.skills', 'Skills')}>
      {chips.map((chip) => (
        <span
          key={chip.code}
          className={`ce-lib-skill${chip.matched ? ' is-match' : ''}`}
          title={chip.matched ? L('ui.skillOfThisSet', "One of this set's skills") : undefined}
        >
          {chip.name}
        </span>
      ))}
      {more > 0 && <span className="ce-lib-skill is-more">+{more}</span>}
    </div>
  );
};

export default SkillChips;
