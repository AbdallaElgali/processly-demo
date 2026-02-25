import { InputField, Specification } from "@/types";
import { v4 as uuidv4 } from 'uuid'; // Important for generating unique IDs for nested specs

const API_URL = process.env.API_URL || 'http://localhost:8000';

export const analyzeDocument = async (projectId: string): Promise<InputField[]> => {
  const response = await fetch(`${API_URL}/specs/extract-specs/?project_id=${projectId}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Document analysis failed');
  }

  const data = await response.json();
  const specs = data.specs; 
  
  console.log('Extracted Specifications:', specs);

  const extractedFields: InputField[] = [];

  // Iterate over the parent keys (U_MIN, U_MAX, etc.)
  Object.keys(specs).forEach((fieldId: string) => {
    const metricsArray = specs[fieldId];
    
    // This will hold all the extracted values for this specific parameter
    const mappedSpecifications: Specification[] = [];

    if (Array.isArray(metricsArray)) {
      // Loop through EVERY value the AI found for this parameter
      metricsArray.forEach((item) => {
        mappedSpecifications.push({
          id: uuidv4(), // Give each extracted value a unique ID for React state management
          value: item.value !== null && item.value !== undefined ? String(item.value) : '',
          unit: item.unit || item.expected_unit || '',
          confidence: item.confidence !== null ? item.confidence * 100 : null,
          
          source: item.reference ? {
            pageNumber: 1, 
            textSnippet: item.reference, 
            boundingBox: { x: 0, y: 0, width: 0, height: 0 }, 
            reason: item.extraction_logic || item.calculation_logic || ''
          } : null, 

          calculated: item.is_calculated || false, 
          rule_passed: !item.rule_violations || item.rule_violations.length === 0,
          rule_violations: item.rule_violations || [],
          requires_review: item.requires_review || false,
        });
      });
    }

    // Push the parent InputField containing the array of specifications
    extractedFields.push({
      id: fieldId,
      type: fieldId,
      label: fieldId, // You can map this to a human-readable label later if needed
      specifications: mappedSpecifications,
    });
  });

  return extractedFields;
};