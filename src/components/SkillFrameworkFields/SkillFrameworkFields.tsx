import React from 'react';
import { MultiSelectSearch, SingleSelectDropdown } from '../SparkMetaForm/SparkMetaForm';
import formStyles from '../SparkMetaForm/SparkMetaForm.module.scss';
import { useLabels } from '../../hooks/useLabels';
import { useSkillFrameworkOptions, useSkillFrameworkSkills } from '../../hooks/useSkillFramework';

export interface SkillFrameworkFieldsProps {
  /** The chosen skill framework id (`competencyFramework`). */
  frameworkId: string | undefined;
  /**
   * Called with the new framework id. Omit it to show the framework read-only - a question follows
   * its question set's skill framework.
   */
  onFrameworkChange?: (frameworkId: string) => void;
  /** Metadata of the node being edited, to read its current skills from the framework's field. */
  values: Record<string, unknown>;
  /** Called with the framework's skill field (`skill`, `cuisine`, ...) and the picked skill codes. */
  onSkillsChange: (skillField: string, codes: string[]) => void;
  readOnly?: boolean;
  idPrefix: string;
}

const asCodes = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

/**
 * "Skill framework" + "Skills": tags a question set or question with a skill framework's skills,
 * saved as codes under that framework's own field (its last category's code), as lern reads them.
 */
export const SkillFrameworkFields: React.FC<SkillFrameworkFieldsProps> = ({
  frameworkId, onFrameworkChange, values, onSkillsChange, readOnly = false, idPrefix,
}) => {
  const L = useLabels();
  const frameworks = useSkillFrameworkOptions();
  const { skills, skillField } = useSkillFrameworkSkills(frameworkId);
  if (frameworks.length === 0 && !frameworkId) return null;

  const selected = skillField ? asCodes(values[skillField]) : [];
  // A stored code the framework no longer has stays visible, so it isn't dropped silently.
  const options = [
    ...skills.map((sk) => ({ value: sk.code, label: sk.name })),
    ...selected.filter((c) => !skills.some((sk) => sk.code === c)).map((c) => ({ value: c, label: c })),
  ];
  const frameworkName = frameworks.find((f) => f.identifier === frameworkId)?.name ?? frameworkId ?? '';

  return (
    <div className={formStyles.pairRow} data-testid={`${idPrefix}-skill-framework`}>
      <div className={formStyles.field}>
        <label htmlFor={`${idPrefix}-skill-framework-picker`} className={formStyles.label}>
          {L('ui.skillFramework', 'Skill framework')}
        </label>
        {onFrameworkChange ? (
          <SingleSelectDropdown
            fieldId={`${idPrefix}-skill-framework-picker`}
            value={frameworkId ?? ''}
            options={frameworks.map((f) => ({ value: f.identifier, label: f.name }))}
            disabled={readOnly}
            placeholder={L('ui.selectSkillFramework', 'Select a skill framework')}
            onChange={onFrameworkChange}
          />
        ) : (
          <span id={`${idPrefix}-skill-framework-picker`}>
            {frameworkName || L('ui.noSkillFramework', 'The question set has no skill framework')}
          </span>
        )}
      </div>
      {frameworkId && skillField && (
        <div className={formStyles.field}>
          <label htmlFor={`${idPrefix}-skills-picker`} className={formStyles.label}>
            {L('ui.skills', 'Skills')}
          </label>
          <MultiSelectSearch
            fieldId={`${idPrefix}-skills-picker`}
            value={selected}
            options={options}
            readOnly={readOnly}
            placeholder={L('ui.selectSkills', 'Select skills')}
            onChange={(codes) => onSkillsChange(skillField, codes)}
          />
        </div>
      )}
    </div>
  );
};

export default SkillFrameworkFields;
