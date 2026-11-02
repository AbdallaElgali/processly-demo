import { apiFetch } from '@/lib/http/apiFetch';
import { config } from '@/api/config';
import { errorMessage } from '@/lib/errors';
import type { FeedbackBody } from '@/lib/feedback/payload';

/** POST /feedback/submit (BDA `src/api_routes/feedback.py`) -> `{message, feedback_id}`. */
export async function submitFeedback(body: FeedbackBody): Promise<{ message: string; feedback_id: string }> {
  const response = await apiFetch(`${config.api}/feedback/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(errorMessage(new Error(await response.text()), 'Feedback could not be sent.'));
  return response.json();
}
