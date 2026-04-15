import { InputField, Specification, SCHEMA_GROUPS } from "@/types";

const API_URL = process.env.API_URL || 'http://localhost:8000';

const schemaLabelMap: Record<string, string> = Object.fromEntries(
  SCHEMA_GROUPS.flatMap(g => g.fields.map(f => [f.id, f.label]))
);

// Helper to safely format the bounding box to the UI's strict {x, y, width, height} requirement
const formatBoundingBox = (bbox: unknown) => {
  if (!bbox || typeof bbox !== 'object') return null;
  const b = bbox as Record<string, unknown>;
  if ('x0' in b && 'x1' in b) return { x: b.x0 as number, y: b.y0 as number, width: (b.x1 as number) - (b.x0 as number), height: (b.y1 as number) - (b.y0 as number) };
  if (Array.isArray(bbox) && bbox.length === 4) return { x: bbox[0], y: bbox[1], width: bbox[2] - bbox[0], height: bbox[3] - bbox[1] };
  if ('width' in b) return b as { x: number; y: number; width: number; height: number };
  return null;
};

const reverseFormatBoundingBox = (bbox: unknown) => {
  if (!bbox || typeof bbox !== 'object') return null;
  const b = bbox as Record<string, unknown>;
  
  // Convert {x, y, width, height} BACK to {x0, y0, x1, y1}
  if ('width' in b && 'height' in b) {
    return {
      x0: b.x as number,
      y0: b.y as number,
      x1: (b.x as number) + (b.width as number),
      y1: (b.y as number) + (b.height as number)
    };
  }
  return b; 
};

// --- NEW REVERSE MAPPER ---
// Converts UI fields back to backend VoltavisionSpecs schema
export const mapFieldsToSpecs = (fields: InputField[] | undefined): Record<string, unknown> | null => {
  if (!fields) return null;
  const specs: Record<string, unknown> = {};
  let hasData = false;

  fields.forEach(field => {
    if (field.specifications && field.specifications.length > 0) {
      hasData = true;
      specs[field.id] = field.specifications.map(spec => {
        
        // THIS IS THE CRITICAL PART:
        const backendSource = spec.source ? {
          ...spec.source,
          boundingBox: reverseFormatBoundingBox(spec.source.boundingBox) 
        } : null;

        return {
          id: spec.id,
          value: spec.value,
          unit: spec.unit,
          confidence: spec.confidence !== null ? spec.confidence / 100 : null,
          source: backendSource,
          is_flagged: field.isFlagged || false,
          flag_reason: field.flagReason || ""
        };
      });
    }
  });

  return hasData ? specs : null;
};
const mapSpecsToFields = (rawSpecs: Record<string, unknown>): InputField[] => {
  const extractedFields: InputField[] = [];

  Object.keys(rawSpecs).forEach((fieldId: string) => {
    const metricsArray = rawSpecs[fieldId];
    if (!Array.isArray(metricsArray) || metricsArray.length === 0) return;

    const mappedSpecifications: Specification[] = metricsArray.map((item: Record<string, unknown>) => {
      const src = (item.source as Record<string, unknown>) || item;
      return {
        id: item.id as string,
        value: item.value !== null && item.value !== undefined ? String(item.value) : (item.ai_value ? String(item.ai_value) : ''),
        unit: (item.unit as string) || (item.expected_unit as string) || '',
        confidence: item.confidence !== null && item.confidence !== undefined ? ((item.confidence as number) * 100) : null,
        source: {
          documentId: (src.documentId as string) || (src.source_document_id as string) || null,
          pageNumber: (src.pageNumber as number) || (src.source_page_number as number) || null,
          textSnippet: (src.textSnippet as string) || (src.source_text_snippet as string) || null,
          reason: (src.reason as string) || (src.source_reason as string) || (item.calculation_logic as string) || null,
          boundingBox: formatBoundingBox((src.boundingBox) || (src.source_bounding_box)),
          tableName: (src.tableName as string) || (src.source_table_name as string) || null,
          cellCoordinates: (src.cellCoordinates as { row: number; column: number }) || (src.source_cell_coordinates as { row: number; column: number }) || null,
        },
        calculated: (item.is_calculated as boolean) || false,
        rule_passed: !item.rule_violations || (item.rule_violations as unknown[]).length === 0,
        rule_violations: (item.rule_violations as string[]) || [],
        requires_review: (item.requires_review as boolean) || false,
      };
    });

    extractedFields.push({
      id: fieldId,
      label: schemaLabelMap[fieldId] ?? fieldId,
      specifications: mappedSpecifications,
    });
  });

  return extractedFields;
};

// --- UPDATED ANALYZE FUNCTION ---
export const analyzeDocument = async (
  projectId: string,
  previousSpecs: Record<string, unknown> | null, // <-- ADDED THIS PARAMETER
  onProgress: (status: string, partialFields: InputField[]) => void
): Promise<InputField[]> => {

  console.log(`[${new Date().toISOString()}] 🚀 Initiating SSE connection...`);

  // If we have previous specs, send them in the body to trigger iterative mode.
  // If not, send no body to trigger the initial blind mode.
  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    }
  };

  if (previousSpecs) {
    fetchOptions.body = JSON.stringify(previousSpecs);
  }

  const response = await fetch(`${API_URL}/specs/stream-specs?project_id=${projectId}`, fetchOptions);

  if (!response.ok || !response.body) {
    throw new Error('Document analysis stream failed to start');
  }

  console.log(`[${new Date().toISOString()}] ✅ Connection established, headers received.`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let accumulatedSpecs: Record<string, unknown> = {};
  let finalFields: InputField[] = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      console.log(`[${new Date().toISOString()}] 🏁 Stream fully closed.`);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const trimmedEvent = event.trim();
      if (trimmedEvent.startsWith('data: ')) {
        try {
          const jsonString = trimmedEvent.substring(6).trim();
          const data = JSON.parse(jsonString) as { status: string; category?: string; parameter?: string; specs?: Record<string, unknown>; final_specs?: Record<string, unknown>; message?: string };

          console.log(`[${new Date().toISOString()}] 🔄 Parsed Event -> Status: ${data.status} | Target: ${data.parameter || data.category || 'N/A'}`);

          // Handle both 'partial' (initial) and 'partial_correction' (iterative) statuses
          if ((data.status === 'partial' || data.status === 'partial_correction') && data.specs) {
            accumulatedSpecs = data.specs;
            const currentFields = mapSpecsToFields(accumulatedSpecs);
            onProgress(data.parameter ? `Correcting ${data.parameter}...` : `Extracting ${data.category}...`, currentFields);
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