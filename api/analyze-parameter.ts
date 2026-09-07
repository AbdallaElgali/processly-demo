import { InputField } from "@/types";
import { config } from "./config";
import { specsStreamToInputFields } from "@/lib/parameter-adapter";

const API_URL = config.api;

export interface SingleParamResult {
  // Scoped to one parameter: exactly one entry, so the reducer's
  // `idx === -1` guard leaves every other field untouched.
  fields: InputField[];
  flagChain: Record<string, string>;
}

export const analyzeParameter = async (
  projectId: string,
  user: { id: string },
  parameter: string,
  previousMetrics: unknown[],
  userHint: string | null,
  onProgress: (status: string) => void,
): Promise<SingleParamResult> => {

  const response = await fetch(
    `${API_URL}/specs/stream-parameter?project_id=${projectId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        current_user: user,
        parameter,
        previous_metrics: previousMetrics,
        user_hint: userHint,
      }),
    },
  );

  if (!response.ok || !response.body) {
    // 400s (no flagged metric, unknown parameter) land here with a JSON body.
    let detail = 'Parameter correction failed to start';
    try {
      const body = await response.json();
      detail = body?.error ?? detail;
    } catch { /* not JSON — keep the default */ }
    throw new Error(detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

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
      const trimmed = event.trim();
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const data = JSON.parse(trimmed.substring(6).trim()) as {
          status: string;
          parameter?: string;
          category?: string;
          frame_count?: number;
          final_specs?: Record<string, unknown>;
          flag_chain?: Record<string, string>;
          message?: string;
        };

        if (data.status === 'targeting') {
          onProgress(`Re-checking ${data.frame_count ?? 0} section(s)...`);
        }
        else if (data.status === 'complete' && data.final_specs) {
          finalFields = specsStreamToInputFields(data.final_specs);
          flagChain = data.flag_chain ?? {};
          onProgress('Applying...');
        }
        else if (data.status === 'error') {
          lastError = data.message ?? 'Unknown backend error';
          console.error('[SingleParam] Backend error:', lastError);
        }
      } catch (e) {
        console.warn('[SingleParam] Could not parse SSE chunk.', e);
      }
    }
  }

  if (finalFields.length === 0) {
    throw new Error(lastError ?? 'Correction returned no result.');
  }

  return { fields: finalFields, flagChain };
};