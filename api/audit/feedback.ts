import { config } from '@/api/config';
import { collectAllPages } from '@/lib/audit/feedback';

const API_BASE_URL = config.api + '/audit';

/**
 * One row of `GET /audit/feedback-list`. The route selects only user_id,
 * project_id, document_id, feedback_type, title, description, status and
 * metadata (`BDA/src/db/feedback.py`), so `id`, `created_at` and
 * `updated_at` are NEVER present today (proposed B23); they stay optional
 * rather than pretending.
 */
export interface FeedbackItem {
    id?: string;
    project_id: string;
    user_id: string;
    document_id?: string | null;
    feedback_type: string;
    title: string;
    description: string;
    status: string;
    created_at?: string;
    updated_at?: string;
    metadata?: Record<string, unknown> | null;
}

export interface FeedbackFilters {
    project_id?: string;
    user_id?: string;
    status?: string;
    limit?: number;  // Default 100, backend maximum 1000
    offset?: number; // Default 0
}

export interface FeedbackResponse {
    feedbacks: FeedbackItem[];
    total: number;
}

function toQuery(filters: FeedbackFilters): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    return params.toString();
}

/** One page. The route returns no total, so `total` is the size of this page only. */
export const fetch_feedback = async (filters: FeedbackFilters, signal?: AbortSignal): Promise<FeedbackResponse> => {
    const response = await fetch(`${API_BASE_URL}/feedback-list?${toQuery(filters)}`, { signal });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const feedbacks: FeedbackItem[] = data.feedbacks ?? [];
    return { feedbacks, total: typeof data.total === 'number' ? data.total : feedbacks.length };
};

/** Every page, so `total` is the real count. */
export const fetch_all_feedback = async (
    filters: Omit<FeedbackFilters, 'limit' | 'offset'>,
    signal?: AbortSignal,
): Promise<FeedbackResponse> => {
    const feedbacks = await collectAllPages(
        async (offset, limit) => (await fetch_feedback({ ...filters, offset, limit }, signal)).feedbacks,
    );
    return { feedbacks, total: feedbacks.length };
};
