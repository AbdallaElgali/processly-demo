import { InputField, Specification } from "@/types";
import { v4 as uuidv4 } from 'uuid'; 

const API_URL = process.env.API_URL || 'http://localhost:8000';

// Helper to safely format the bounding box to the UI's strict {x, y, width, height} requirement
const formatBoundingBox = (bbox: any) => {
  if (!bbox) return null;
  // If backend sends { x0, y0, x1, y1 }
  if ('x0' in bbox && 'x1' in bbox) {
    return { x: bbox.x0, y: bbox.y0, width: bbox.x1 - bbox.x0, height: bbox.y1 - bbox.y0 };
  }
  // If backend sends [x0, y0, x1, y1]
  if (Array.isArray(bbox) && bbox.length === 4) {
    return { x: bbox[0], y: bbox[1], width: bbox[2] - bbox[0], height: bbox[3] - bbox[1] };
  }
  // If it already matches
  if ('width' in bbox) return bbox;
  return null;
};

const mapSpecsToFields = (rawSpecs: any): InputField[] => {
  const extractedFields: InputField[] = [];

  Object.keys(rawSpecs).forEach((fieldId: string) => {
    const metricsArray = rawSpecs[fieldId];
    if (!Array.isArray(metricsArray) || metricsArray.length === 0) return;

    const mappedSpecifications: Specification[] = metricsArray.map((item: any) => {
      // Handle both nested { source: {...} } and flat Pydantic models
      const src = item.source || item; 

      return {
        id: item.id,
        value: item.value !== null && item.value !== undefined ? String(item.value) : (item.ai_value ? String(item.ai_value) : ''),
        unit: item.unit || item.expected_unit || '',
        confidence: item.confidence !== null && item.confidence !== undefined ? (item.confidence * 100) : null,
        
        source: {
          documentId: src.documentId || src.source_document_id || null,
          pageNumber: src.pageNumber || src.source_page_number || null, 
          textSnippet: src.textSnippet || src.source_text_snippet || null, 
          reason: src.reason || src.source_reason || item.calculation_logic || null,
          boundingBox: formatBoundingBox(src.boundingBox || src.source_bounding_box), 
          tableName: src.tableName || src.source_table_name || null,
          cellCoordinates: src.cellCoordinates || src.source_cell_coordinates || null
        }, 

        calculated: item.is_calculated || false, 
        rule_passed: !item.rule_violations || item.rule_violations.length === 0,
        rule_violations: item.rule_violations || [],
        requires_review: item.requires_review || false,
      };
    });

    extractedFields.push({
      id: fieldId,
      type: fieldId,
      label: fieldId, 
      specifications: mappedSpecifications,
    });
  });

  return extractedFields;
};


export const analyzeDocument = async (
  projectId: string,
  onProgress: (status: string, partialFields: InputField[]) => void
): Promise<InputField[]> => {
  
  console.log(`[${new Date().toISOString()}] 🚀 Initiating SSE connection...`);

  const response = await fetch(`${API_URL}/specs/stream-specs?project_id=${projectId}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream' 
    },
    body: JSON.stringify({ frames: [], docs: [] }) 
  });

  if (!response.ok || !response.body) {
    throw new Error('Document analysis stream failed to start');
  }

  console.log(`[${new Date().toISOString()}] ✅ Connection established, headers received.`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  
  let accumulatedSpecs: any = {};
  let finalFields: InputField[] = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      console.log(`[${new Date().toISOString()}] 🏁 Stream fully closed.`);
      break;
    }

    // DIAGNOSTIC LOG 1: Proves network chunking. 
    // If these all print at the exact same time, your backend/proxy is buffering.
    console.log(`[${new Date().toISOString()}] 📦 Raw bytes received: ${value?.byteLength}`);

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const trimmedEvent = event.trim();
      if (trimmedEvent.startsWith('data: ')) {
        try {
          const jsonString = trimmedEvent.substring(6).trim();
          const data = JSON.parse(jsonString);

          // DIAGNOSTIC LOG 2: Shows exactly what event we just successfully parsed
          console.log(`[${new Date().toISOString()}] 🔄 Parsed Event -> Status: ${data.status} | Category: ${data.category || 'N/A'}`);

          if (data.status === 'partial' && data.specs) {
            accumulatedSpecs = data.specs; 
            const currentFields = mapSpecsToFields(accumulatedSpecs);
            onProgress(`Extracting ${data.category}...`, currentFields);
          } 
          else if (data.status === 'refining') {
            console.log(`[${new Date().toISOString()}] 🛠️ Triggering QA Refiner pass...`);
            onProgress('Running Final QA Pass...', mapSpecsToFields(accumulatedSpecs));
          } 
          else if (data.status === 'complete' && data.final_specs) {
            console.log(`[${new Date().toISOString()}] ✨ Final specs received.`, data.final_specs);
            finalFields = mapSpecsToFields(data.final_specs);
            onProgress('Finalizing UI...', finalFields); 
          } 
          else if (data.status === 'error') {
            console.error(`[${new Date().toISOString()}] ❌ Backend Error:`, data.message);
          }
        } catch (e) {
          console.warn(`[${new Date().toISOString()}] ⚠️ Could not parse SSE chunk. Payload might be corrupted.`, e);
        }
      }
    }
  }

  return finalFields;
};