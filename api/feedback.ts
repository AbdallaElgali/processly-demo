// api/parameters.ts
import { config } from './config';

const API_URL = config.api;
// Make sure this points to the router prefix where your endpoints live
const API_BASE_URL = API_URL + '/feedback'; 

export interface UserFeedbackPayload {
  user_id: string;
  project_id: string;
  document_id?: string | null;
  feedback_type: string;
  title?: string | null;
  description: string;
  status?: string;
  metadata?: Record<string, any> | null;
}

export async function submitFeedbackApi(payload: UserFeedbackPayload) {
  // Replace with your actual backend URL/prefix if different
  const response = await fetch(`${API_BASE_URL}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Attempt to parse the FastAPI HTTP exception detail
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to submit feedback.');
  }

  return response.json();
}