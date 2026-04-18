import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InputField, Specification, SCHEMA_GROUPS } from '@/types';
import { ProjectParameter } from '@/api/projects';
import { useAuth } from '@/contexts/AuthContext';
import { flagParameter, unFlagParameter } from '@/api/parameters';

const generateDefaultFields = (): InputField[] => {
  return SCHEMA_GROUPS.flatMap(group =>
    group.fields.map(f => ({
      id: f.id,
      label: f.label,
      specifications: [],
      selectedSpecId: undefined
    }))
  );
};

export const useParameterManager = (
  autoSaveField?: (fieldId: string, currentFields: InputField[]) => Promise<void>
) => {
  const { user } = useAuth(); // Get current user_id for the API calls
  const [fields, setFields] = useState<InputField[]>(generateDefaultFields());
  const [isSyncing, setIsSyncing] = useState<string | null>(null); // Track which field is saving

  const handleFieldChange = useCallback((fieldId: string, value: string, unit: string) => {
    setFields(prev => prev.map(field => {
      if (field.id === fieldId) {
        const activeId = field.selectedSpecId;

        if (activeId) {
          const updatedSpecs = field.specifications.map(s =>
            s.id === activeId ? { ...s, value, unit } : s
          );
          return { ...field, specifications: updatedSpecs };
        } else {
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
        }
      }
      return field;
    }));
  }, []);

  const hydrateFieldsFromDB = useCallback((dbParameters: ProjectParameter[]) => {
    setFields(prevFields => {
      return prevFields.map(uiField => {
        const dbParam = dbParameters.find(p => p.parameter_key === uiField.id);
        if (dbParam && dbParam.human_flagged){
          console.log(`Parameter ${uiField.id} is flagged in the database with reason: ${dbParam.human_flagged}`);
        }
        if (dbParam) {
          const dbSpec: Specification = {
            id: dbParam.id,
            value: dbParam.final_value?.toString() ?? '',
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

          return {
            ...uiField,
            specifications: [dbSpec],
            selectedSpecId: dbSpec.id,
            isFlagged: dbParam.human_flagged, 
            flagReason: dbParam.flag_reason ?? ''
          };
        }
        return uiField;
      });
    });
  }, []);

  const handleRemoveField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleSwitchSpecification = useCallback((fieldId: string, specId: string) => {
    setFields(prev => prev.map(field =>
      field.id === fieldId ? { ...field, selectedSpecId: specId } : field
    ));
  }, []);

  const resetFields = useCallback(() => {
    setFields(generateDefaultFields());
  }, []);

  const handlePopulateExtractedData = useCallback((extractedFields: InputField[]) => {
    setFields(prevFields => {
      const updatedFields = [...prevFields];

      extractedFields.forEach(incomingField => {
        const fieldIndex = updatedFields.findIndex(f => f.id === incomingField.id);

        if (fieldIndex !== -1 && incomingField.specifications && incomingField.specifications.length > 0) {
          const sortedSpecs = [...incomingField.specifications].sort((a, b) =>
            (b.confidence || 0) - (a.confidence || 0)
          );

          updatedFields[fieldIndex] = {
            ...updatedFields[fieldIndex],
            specifications: sortedSpecs,
            selectedSpecId: sortedSpecs[0].id
          };
        }
      });

      return updatedFields;
    });
  }, []);

  const handleFlag = useCallback(async (fieldId: string, isFlagged: boolean, reason?: string | null) => {
    const field = fields.find(f => f.id === fieldId);
    let parameterId: string | undefined = field?.selectedSpecId;
    // Tracks an updated fields snapshot when a placeholder spec is injected
    let fieldsForSave = fields;

    setIsSyncing(fieldId);

    try {
      // Field has no DB record yet — mint a candidate UUID so the backend has a
      // known selected_candidate_id to flag against (same pattern as handleFieldChange).
      if (!parameterId && autoSaveField) {
        const placeholderId = uuidv4();
        const placeholderSpec: Specification = {
          id: placeholderId,
          value: '',
          unit: '',
          confidence: null,
          source: null,
          calculated: false,
          rule_passed: true,
          rule_violations: [],
          requires_review: false,
        };
        fieldsForSave = fields.map(f =>
          f.id === fieldId
            ? { ...f, specifications: [placeholderSpec], selectedSpecId: placeholderId }
            : f
        );
        // Save with selected_candidate_id = placeholderId so the backend can find it
        await autoSaveField(fieldId, fieldsForSave);
        parameterId = placeholderId;
      }

      if (!parameterId || !user?.id) {
        console.error("Missing parameterId or UserID for flagging");
        return;
      }

      if (isFlagged) {
        await flagParameter(user.id, parameterId, reason ?? 'No reason provided');
      } else {
        await unFlagParameter(user.id, parameterId);
      }

      // Single update: apply placeholder spec (if any) + flag state together
      setFields(prev => prev.map(f => {
        if (f.id !== fieldId) return f;
        // Use the placeholder version of this field if one was created
        const base = fieldsForSave !== fields
          ? (fieldsForSave.find(ff => ff.id === fieldId) ?? f)
          : f;
        return { ...base, isFlagged, flagReason: reason ?? '' };
      }));
    } catch (error) {
      console.error("Failed to sync flag to backend:", error);
    } finally {
      setIsSyncing(null);
    }
  }, [fields, user?.id, autoSaveField]);

  return {
    fields,
    handleFieldChange,
    handleRemoveField,
    handleSwitchSpecification,
    handlePopulateExtractedData,
    hydrateFieldsFromDB,
    resetFields,
    handleFlag,
    isSyncing
  };
};
