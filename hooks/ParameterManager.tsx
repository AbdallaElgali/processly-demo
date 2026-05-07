import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InputField, Specification, SCHEMA_GROUPS } from '@/types';
import { ProjectParameter } from '@/api/projects';
import { useAuth } from '@/contexts/AuthContext';
import { flagParameter, unFlagParameter } from '@/api/parameters';

// Flat lookup: parameter_key → display label
const FIELD_LABEL_MAP = new Map(
  SCHEMA_GROUPS.flatMap(g => g.fields.map(f => [f.id, f.label]))
);

export const useParameterManager = () => {
  const { user } = useAuth();
  const [fields, setFields] = useState<InputField[]>([]);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const hydrateFieldsFromDB = useCallback((dbParameters: ProjectParameter[]) => {
    const hydratedFields: InputField[] = dbParameters.map(dbParam => {
      const label = FIELD_LABEL_MAP.get(dbParam.parameter_key) ?? dbParam.parameter_key;
      const base = {
        id: dbParam.parameter_key,
        dbId: dbParam.id,
        label,
        isFlagged: dbParam.human_flagged,
        flagReason: dbParam.flag_reason ?? '',
      };

      if (dbParam.final_value !== null) {
        const dbSpec: Specification = {
          id: dbParam.id,
          value: dbParam.final_value.toString(),
          unit: dbParam.final_unit ?? '',
          confidence: dbParam.confidence ?? null,
          source: {
            documentId: null,
            textSnippet: dbParam.source_text_snippet ?? null,
            pageNumber: dbParam.source_page_number ?? null,
            reason: null,
            boundingBox: null,
            tableName: null,
            cellCoordinates: null,
          },
          calculated: false,
          rule_passed: true,
          rule_violations: [],
          requires_review: false,
        };
        return { ...base, specifications: [dbSpec], selectedSpecId: dbSpec.id };
      }

      return { ...base, specifications: [], selectedSpecId: undefined };
    });

    setFields(hydratedFields);
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
          specifications: field.specifications.map(s =>
            s.id === activeId ? { ...s, value, unit } : s
          ),
        };
      }
      const newSpecId = uuidv4();
      const newSpec: Specification = {
        id: newSpecId,
        value,
        unit,
        confidence: null,
        source: null,
        calculated: false,
        rule_passed: true,
        rule_violations: [],
        requires_review: false,
      };
      return { ...field, specifications: [newSpec], selectedSpecId: newSpecId };
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

  const handleFlag = useCallback(async (fieldId: string, isFlagged: boolean, reason?: string | null) => {
    const field = fields.find(f => f.id === fieldId);

    if (!field?.dbId || !user?.id) {
      console.error('Missing dbId or user ID — cannot flag parameter');
      return;
    }

    setIsSyncing(fieldId);
    try {
      if (isFlagged) {
        await flagParameter(user.id, field.dbId, reason ?? 'No reason provided');
      } else {
        await unFlagParameter(user.id, field.dbId);
      }
      setFields(prev => prev.map(f =>
        f.id === fieldId ? { ...f, isFlagged, flagReason: reason ?? '' } : f
      ));
    } catch (error) {
      console.error('Failed to sync flag to backend:', error);
    } finally {
      setIsSyncing(null);
    }
  }, [fields, user?.id]);

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
