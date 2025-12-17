import {InputField } from "@/types";

const API_URL = process.env.API_URL || 'http://localhost:8000';



export const analyzeDocument = async(file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(API_URL + '/process-document', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Document analysis failed');
  }

  console.log('API Response Status:', response.status);
  const data = await response.json();
  
  const specs = data.specifications[0];
  console.log('Extracted Specifications:', specs);

  const fieldIDs = Object.keys(specs);

  const extractedFields: InputField[] = fieldIDs.map((fieldId: string) => {
        const item = specs[fieldId];
        
        const field: InputField = {
            id: fieldId, 
            
            label: fieldId, 
            type: 'Type Placeholder',
            
            confidence: item.confidence * 100,
            source: item.source, // Assuming 'source' exists
            value: item.value,
            calculated: item.is_calculated, 
            source_confidence: item.source_confidence * 100,
            rule_passed: item.rule_passed,
            rule_violations: item.rule_violations,
            requires_review: item.requires_review,
        };
        
        return field;
        });

  return extractedFields;
}

