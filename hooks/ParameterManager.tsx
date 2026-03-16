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

  // Handle manual typing in the input field
  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setFields(prev => prev.map(field => {
      if (field.id === fieldId) {
        const activeId = field.selectedSpecId;
        
        if (activeId) {
          // Update the value of the currently selected specification
          const updatedSpecs = field.specifications.map(s => 
            s.id === activeId ? { ...s, value } : s
          );
          return { ...field, specifications: updatedSpecs };
        } else {
          // If no specs exist yet, create a manual one on the fly
          const newSpecId = uuidv4();
          const newSpec = { 
            id: newSpecId, value, confidence: null, unit: null, source: null 
          };
          return { 
            ...field, 
            specifications: [newSpec], 
            selectedSpecId: newSpecId 
          };
        }
      }
      return field;
    }));
  }, []);

  const handleRemoveField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  }, []);

  // NEW: Switch the active specification when a suggestion chip is clicked
  const handleSwitchSpecification = useCallback((fieldId: string, specId: string) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, selectedSpecId: specId } : field
    ));
  }, []);

  // Set the extracted data, sorting by confidence to pick the best default
  const handlePopulateExtractedData = useCallback((extractedData: InputField[]) => {
    const processedData = extractedData.map(field => {
      if (field.specifications && field.specifications.length > 0) {
        // Sort specifications by highest confidence first
        const sortedSpecs = [...field.specifications].sort((a, b) => 
          (b.confidence || 0) - (a.confidence || 0)
        );
        // Automatically select the highest confidence item
        return { ...field, specifications: sortedSpecs, selectedSpecId: sortedSpecs[0].id };
      }
      return field;
    });
    setFields(processedData);
  }, []);

  return { 
    fields, 
    handleFieldChange, 
    handleRemoveField, 
    handleSwitchSpecification, 
    handlePopulateExtractedData 
  };
};