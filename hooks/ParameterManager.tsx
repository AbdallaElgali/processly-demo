import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InputField, SCHEMA_GROUPS } from '@/types';

const generateDefaultFields = (): InputField[] => {
  return SCHEMA_GROUPS.flatMap(group => 
    group.fields.map(f => ({
      id: f.id, 
      type: f.id,
      label: f.label,
      specifications: [], // Initialize with empty arrays
      selectedSpecId: undefined
    }))
  );
};

export const useParameterManager = () => {
  const [fields, setFields] = useState<InputField[]>(generateDefaultFields());

  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setFields(prev => prev.map(field => {
      if (field.id === fieldId) {
        const activeId = field.selectedSpecId;
        
        if (activeId) {
          const updatedSpecs = field.specifications.map(s => 
            s.id === activeId ? { ...s, value } : s
          );
          return { ...field, specifications: updatedSpecs };
        } else {
          const newSpecId = uuidv4();
          const newSpec = { id: newSpecId, value, confidence: null, unit: null, source: null };
          return { ...field, specifications: [newSpec], selectedSpecId: newSpecId };
        }
      }
      return field;
    }));
  }, []);

    // Add this to your useParameterManager hook
  const hydrateFieldsFromDB = useCallback((dbParameters: any[]) => {
    console.log("Hydrating fields from DB parameters:", dbParameters);
    setFields(prevFields => {
      return prevFields.map(uiField => {
        // Find matching parameter from DB
        const dbParam = dbParameters.find(p => p.parameter_key === uiField.id);
        
        if (dbParam) {
          // Create a specification object from the DB record
          const dbSpec = {
            id: dbParam.selected_candidate_id,
            value: dbParam.final_value?.toString() || '',
            unit: dbParam.final_unit || '',
            confidence: dbParam.confidence || null, // From the JOIN in your get_full_project_details_db
            source: {
              documentId: null, // You can expand your DB join to include these
              textSnippet: dbParam.source_text_snippet || null,
              pageNumber: dbParam.source_page_number || null,
            }
          };

          return {
            ...uiField,
            specifications: [dbSpec],
            selectedSpecId: dbSpec.id
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

  // THE FIX: Merge incoming AI data into the existing UI template
  const handlePopulateExtractedData = useCallback((extractedFields: InputField[]) => {
    setFields(prevFields => {
      // 1. Create a copy of the current state (all default fields + any manual typing)
      const updatedFields = [...prevFields];

      // 2. Loop through only the parameters the AI actually found
      extractedFields.forEach(incomingField => {
        // 3. Find the matching placeholder field in our UI
        const fieldIndex = updatedFields.findIndex(f => f.id === incomingField.id);
        
        if (fieldIndex !== -1 && incomingField.specifications && incomingField.specifications.length > 0) {
          
          // Sort specifications by highest confidence first
          const sortedSpecs = [...incomingField.specifications].sort((a, b) => 
            (b.confidence || 0) - (a.confidence || 0)
          );
          
          // 4. Update ONLY this specific field, injecting the AI candidates
          updatedFields[fieldIndex] = {
            ...updatedFields[fieldIndex],
            specifications: sortedSpecs,
            selectedSpecId: sortedSpecs[0].id // Auto-select the most confident one
          };
        }
      });

      // 5. Return the merged list (keeps all the empty fields visible!)
      return updatedFields;
    });
  }, []);

  return { 
    fields, 
    handleFieldChange, 
    handleRemoveField, 
    handleSwitchSpecification, 
    handlePopulateExtractedData,
    hydrateFieldsFromDB,
    resetFields
  };
};