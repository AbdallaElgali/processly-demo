import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InputField, Specification } from '@/types';
import { ProjectParameter } from '@/api/projects';
import { useAuth } from '@/contexts/AuthContext';
import { flagParameter, unFlagParameter } from '@/api/parameters';
import { dbParamToInputField } from '@/lib/parameter-adapter';

interface UseParameterManagerOptions {
  // Persists the given fields to the backend. Provided by the page so that flag
  // changes are durable immediately (without waiting for an explicit Save).
  persist?: (fields: InputField[]) => Promise<void>;
}

export const useParameterManager = (options?: UseParameterManagerOptions) => {
  const { user } = useAuth();
  const persist = options?.persist;
  const [fields, setFields] = useState<InputField[]>([]);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const hydrateFieldsFromDB = useCallback((dbParameters: ProjectParameter[]) => {
    setFields(dbParameters.map(dbParamToInputField));
  }, []);

  const resetFields = useCallback(() => {
    setFields([]);
  }, []);

  const handleFieldChange = useCallback((fieldId: string, value: string, unit: string) => {
    setFields(prev => prev.map(field => {
      if (field.id !== fieldId) return field;
      const activeId = field.selectedSpecId;
      if (activeId) {
        return {
          ...field,
          reviewAction: 'MODIFIED',
          specifications: field.specifications.map(s =>
            s.id === activeId ? { ...s, value, unit } : s
          ),
        };
      }
      // No spec yet — a human is entering a brand-new value (no AI candidate).
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
      return { ...field, reviewAction: 'MODIFIED', specifications: [newSpec], selectedSpecId: newSpec.id };
    }));
  }, []);

  const handleRemoveField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleSwitchSpecification = useCallback((fieldId: string, specId: string) => {
    setFields(prev => prev.map(field =>
      field.id === fieldId ? { ...field, selectedSpecId: specId } : field
    ));
  }, []);

  const handlePopulateExtractedData = useCallback((extractedFields: InputField[]) => {
    setFields(prevFields => {
      const updatedFields = [...prevFields];
      extractedFields.forEach(incomingField => {
        const idx = updatedFields.findIndex(f => f.id === incomingField.id);
        if (idx !== -1 && incomingField.specifications?.length > 0) {
          const sortedSpecs = [...incomingField.specifications].sort((a, b) =>
            (b.confidence || 0) - (a.confidence || 0)
          );
          updatedFields[idx] = {
            ...updatedFields[idx],
            specifications: sortedSpecs,
            selectedSpecId: sortedSpecs[0].id,
          };
        }
      });
      return updatedFields;
    });
  }, []);

  // Single flag write-path: hits the flag ticket endpoint AND persists the
  // parameter row so `human_flagged` survives a reload in both editor and
  // review modes. (Previously the column write only happened on explicit Save,
  // so review-mode flags were lost on refresh.)
  const handleFlag = useCallback(async (fieldId: string, isFlagged: boolean, reason?: string | null) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field?.dbId || !user?.id) {
      console.error('Missing dbId or user ID — cannot update flag');
      return;
    }

    const activeSpec = field.specifications.find(s => s.id === field.selectedSpecId) ?? field.specifications[0];
    const candidateId = activeSpec?.candidateId ?? null;

    setIsSyncing(fieldId);
    try {
      let nextFields: InputField[];
      if (isFlagged) {
        // Chain a new ticket to the existing one (if any) so the backend can track lineage.
        const newFlagId = await flagParameter(
          user.id,
          field.dbId,
          candidateId,
          field.activeFlagId ?? null,
          reason ?? 'No reason provided'
        );
        nextFields = fields.map(f =>
          f.id === fieldId ? { ...f, isFlagged: true, flagReason: reason ?? '', activeFlagId: newFlagId } : f
        );
      } else {
        if (field.activeFlagId) {
          await unFlagParameter(field.activeFlagId, null, 'DISMISSED');
        }
        nextFields = fields.map(f =>
          f.id === fieldId ? { ...f, isFlagged: false, flagReason: null, activeFlagId: null } : f
        );
      }

      setFields(nextFields);
      if (persist) await persist(nextFields);
    } catch (error) {
      console.error('Failed to sync flag to backend:', error);
    } finally {
      setIsSyncing(null);
    }
  }, [fields, user?.id, persist]);

  return {
    fields,
    handleFieldChange,
    handleRemoveField,
    handleSwitchSpecification,
    handlePopulateExtractedData,
    hydrateFieldsFromDB,
    resetFields,
    handleFlag,
    isSyncing,
  };
};
