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
  
  const specs = data.specifications;
  console.log('Extracted Specifications:', specs);

  const fieldIDs = Object.keys(specs);

  const extractedFields: InputField[] = fieldIDs.map((fieldId: string) => {
        const item = specs[fieldId];
        
        // You need external logic to determine the 'label' and 'unit' 
        // since they are not in the raw data from your first example.
        // You should use the FIELD_TYPES list you created earlier for this!
        
        const field: InputField = {
            // ID comes from the key of the dictionary
            id: fieldId, 
            
            // You need to pull 'label' and 'unit' from your static FIELD_TYPES map
            // (This requires having the FIELD_TYPES list available and searchable)
            label: 'Label Placeholder', 
            type: 'Type Placeholder',
            
            confidence: item.confidence,
            source: item.source, // Assuming 'source' exists in the original data
            value: item.value,
            calculated: item.is_calculated, // Use is_calculated from your Python output
            source_confidence: item.source_confidence,
            rule_passed: item.rule_passed,
            rule_violations: item.rule_violations,
            requires_review: item.requires_review,
        };
        
        return field;
        });

  return extractedFields;
}

