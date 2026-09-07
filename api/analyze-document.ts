import { InputField } from "@/types";
import { config } from "./config";
import { specsStreamToInputFields } from "@/lib/parameter-adapter";

const API_URL = config.api;

export interface AnalyzeResult {
  fields: InputField[];
  // Maps the flag id we SENT -> the successor the backend opened. Advancing
  // these client-side is what lets a second correction chain instead of
  // tripping the `status != 'OPEN'` guard in resolve_and_chain_flag_db.
  flagChain: Record<string, string>;
}

export const analyzeDocument = async (
  projectId: string,
  user: { id: string },
  previousSpecs: Record<string, unknown> | null,
  onProgress: (status: string, partialFields: InputField[]) => void
): Promise<AnalyzeResult> => {

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    }
  };

  const payload: Record<string, unknown> = {
    current_user: user
  };

  if (previousSpecs) {
    payload.previous_specs = previousSpecs;
  }

  fetchOptions.body = JSON.stringify(payload);

  const response = await fetch(`${API_URL}/specs/stream-specs?project_id=${projectId}`, fetchOptions);

  if (!response.ok || !response.body) {
    throw new Error('Document analysis stream failed to start');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let accumulatedSpecs: Record<string, unknown> = {};
  let finalFields: InputField[] = [];
  let flagChain: Record<string, string> = {};
  let lastError: string | null = null;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const trimmedEvent = event.trim();
      if (trimmedEvent.startsWith('data: ')) {
        try {
          const jsonString = trimmedEvent.substring(6).trim();
          const data = JSON.parse(jsonString) as {
            status: string;
            category?: string;
            parameter?: string;
            specs?: Record<string, unknown>;
            final_specs?: Record<string, unknown>;
            flag_chain?: Record<string, string>;
            message?: string;
          };

          if ((data.status === 'partial' || data.status === 'partial_correction') && data.specs) {
            accumulatedSpecs = data.specs;
            const currentFields = specsStreamToInputFields(accumulatedSpecs);
            onProgress(data.parameter ? `Correcting ${data.parameter}...` : `Extracting ${data.category}...`, currentFields);
          }
          else if (data.status === 'refining') {
            onProgress('Running Final QA Pass...', specsStreamToInputFields(accumulatedSpecs));
          }
          else if (data.status === 'complete' && data.final_specs) {
            finalFields = specsStreamToInputFields(data.final_specs);
            // Emitted only after the DB save, so it may be absent on a save failure.
            flagChain = data.flag_chain ?? {};
            onProgress('Finalizing UI...', finalFields);
          }
          else if (data.status === 'error') {
            lastError = data.message ?? 'Unknown backend error';
            console.error(`[${new Date().toISOString()}] ❌ Backend Error:`, lastError);
          }
        } catch (e) {
          console.warn(`[${new Date().toISOString()}] ⚠️ Could not parse SSE chunk. Payload might be corrupted.`, e);
        }
      }
    }
  }

  // The backend's terminal error events ('Extraction ended without a result',
  // stream failures) arrive INSTEAD of `complete`. Without this, the caller
  // silently receives an empty field list and wipes nothing — but also shows
  // no failure.
  if (finalFields.length === 0 && lastError) {
    throw new Error(lastError);
  }

  return { fields: finalFields, flagChain };
};