'use client';

import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InputField, Specification } from '@/types';
import { updateProjectParameter } from '@/api/projects';
import { useAuth } from '@/contexts/AuthContext';
import { updateResolvedBy } from '@/api/parameters';
import { inputFieldToParameterInput } from '@/lib/parameter-adapter';
import { clearHumanFlag, raiseHumanFlag } from '@/lib/review/flagging';
import { projectDataStore } from '@/lib/project-data/store';
import { useProjectData } from '@/lib/jobs/hooks';

/**
 * Parameter editing for one project.
 *
 * `fields` now live in ProjectDataStore, keyed by projectId, instead of in a
 * single array owned by the page. That is the D11 fix: a running job writes to
 * its OWN project, so switching projects can no longer let one project's
 * results land in another's rows. This hook is a thin set of handlers over
 * that store.
 */
interface UseParameterManagerOptions {
  /** Persists the given fields immediately, without waiting for an explicit Save. */
  persist?: (fields: InputField[]) => Promise<void>;
  projectId: string | null;
}

export const useParameterManager = ({ persist, projectId }: UseParameterManagerOptions) => {
  const { user } = useAuth();
  const projectState = useProjectData(projectId);
  const fields = projectState?.fields ?? [];

  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);

  const setFields = useCallback(
    (next: InputField[]) => {
      if (projectId) projectDataStore.setFields(projectId, next);
    },
    [projectId],
  );

  const handleFieldChange = useCallback(
    (fieldId: string, value: string, unit: string) => {
      setFields(
        fields.map((field) => {
          if (field.id !== fieldId) return field;
          const activeId = field.selectedSpecId;
          if (activeId) {
            return {
              ...field,
              reviewAction: 'MODIFIED',
              specifications: field.specifications.map((s) =>
                s.id === activeId ? { ...s, value, unit } : s,
              ),
            };
          }
          // No candidate yet: a human is entering a brand-new value.
          const newSpec: Specification = {
            id: uuidv4(),
            candidateId: null,
            value,
            unit,
            confidence: null,
            source: null,
            calculated: false,
            rule_passed: true,
            rule_violations: [],
            requires_review: false,
          };
          return {
            ...field,
            reviewAction: 'MODIFIED',
            specifications: [newSpec],
            selectedSpecId: newSpec.id,
          };
        }),
      );
    },
    [fields, setFields],
  );

  const handleRemoveField = useCallback(
    (id: string) => setFields(fields.filter((f) => f.id !== id)),
    [fields, setFields],
  );

  const handleSwitchSpecification = useCallback(
    (fieldId: string, specId: string) => {
      setFields(fields.map((f) => (f.id === fieldId ? { ...f, selectedSpecId: specId } : f)));

      const targetField = fields.find((f) => f.id === fieldId);
      const currentSpec = targetField?.specifications.find((s) => s.candidateId === specId);

      // Telling the backend which candidate resolved an open flag is only
      // meaningful when there IS an open flag and a real candidate.
      if (targetField?.isFlagged && targetField.activeFlagId && currentSpec?.candidateId) {
        updateResolvedBy(targetField.activeFlagId, currentSpec.candidateId).catch((error) =>
          console.error('Failed to update resolver:', error),
        );
      }
    },
    [fields, setFields],
  );

  const handleUpdateMetadataLocal = useCallback(
    (fieldId: string, data: updateProjectParameter) => {
      setFields(
        fields.map((f) =>
          f.id === fieldId
            ? {
                ...f,
                label: data.parameter_alias || f.id,
                parameter_alias: data.parameter_alias,
                description_override: data.description_override,
                ai_instructions: data.ai_instructions,
              }
            : f,
        ),
      );
    },
    [fields, setFields],
  );

  /**
   * Single flag write-path (contract fix H1). A parameter with no AI candidate
   * cannot have a flag ticket, so raiseHumanFlag persists the flag on the
   * parameter row instead of 422-ing into a swallowed catch.
   */
  const handleFlag = useCallback(
    async (fieldId: string, isFlagged: boolean, reason?: string | null): Promise<string | null> => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field?.dbId || !user?.id || !projectId) {
        console.error('Missing dbId, user or project — cannot update flag');
        return null;
      }

      const activeSpec =
        field.specifications.find((s) => s.id === field.selectedSpecId) ?? field.specifications[0];
      const candidateId = activeSpec?.candidateId ?? null;

      setIsSyncing(fieldId);
      setFlagError(null);
      try {
        let nextFields: InputField[];
        let resultFlagId: string | null = null;

        if (isFlagged) {
          const result = await raiseHumanFlag({
            userId: user.id,
            projectParameterId: field.dbId,
            candidateId,
            parentFlagId: field.activeFlagId ?? null,
            reason: reason ?? 'No reason provided',
          });
          resultFlagId = result.flagId;
          nextFields = fields.map((f) =>
            f.id === fieldId
              ? { ...f, isFlagged: true, flagReason: reason ?? '', activeFlagId: result.flagId }
              : f,
          );
        } else {
          await clearHumanFlag(field.activeFlagId ?? null);
          nextFields = fields.map((f) =>
            f.id === fieldId ? { ...f, isFlagged: false, flagReason: null, activeFlagId: null } : f,
          );
        }

        setFields(nextFields);
        if (persist) await persist(nextFields);
        return resultFlagId;
      } catch (error) {
        // Previously this only reached console.error, so a rejected flag left
        // the row looking flagged until the next reload.
        console.error('Failed to sync flag to backend:', error);
        setFlagError(error instanceof Error ? error.message : 'Failed to save the flag.');
        return null;
      } finally {
        setIsSyncing(null);
      }
    },
    [fields, user?.id, persist, projectId, setFields],
  );

  return {
    fields,
    handleFieldChange,
    handleRemoveField,
    handleSwitchSpecification,
    handleFlag,
    handleUpdateMetadataLocal,
    isSyncing,
    flagError,
    clearFlagError: useCallback(() => setFlagError(null), []),
  };
};
