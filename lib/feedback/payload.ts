/**
 * The body of `POST /feedback/submit` (BDA `UserFeedback`): user_id and
 * project_id are required UUIDs, feedback_type is free text ('general',
 * 'document-specific'), the rest is optional.
 */

export interface FeedbackParameter {
  key: string;
  alias?: string | null;
}

export interface FeedbackBody {
  user_id: string;
  project_id: string;
  feedback_type: string;
  title: string | null;
  description: string;
  status: 'new';
  metadata?: Record<string, string>;
}

/** The project id in a `/projects/<id>/...` address, or null on any other page. */
export function projectIdFromPath(pathname: string | null | undefined): string | null {
  const match = pathname?.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

export function buildFeedbackBody(input: {
  userId: string;
  projectId: string;
  title?: string;
  description: string;
  parameter?: FeedbackParameter;
}): FeedbackBody {
  const body: FeedbackBody = {
    user_id: input.userId,
    project_id: input.projectId,
    feedback_type: input.parameter ? 'parameter' : 'general',
    title: input.title?.trim() || null,
    description: input.description.trim(),
    status: 'new',
  };
  if (input.parameter) {
    body.metadata = { parameter_key: input.parameter.key };
    if (input.parameter.alias) body.metadata.parameter_alias = input.parameter.alias;
  }
  return body;
}

/** A sentence for the first thing missing, or null when the feedback can be sent. */
export function validateFeedback(input: { projectId: string | null; description: string }): string | null {
  if (!input.projectId) return 'Choose the project this feedback is about.';
  if (!input.description.trim()) return 'Write what you would like to tell us.';
  return null;
}
