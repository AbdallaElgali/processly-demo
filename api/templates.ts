import { config } from './config';

const API_URL = config.api;
// Note: Adjusted to match your FastAPI router prefix, assuming API_URL points to the base domain
const API_BASE_URL = API_URL + '/extraction-templates';

// --- Interfaces ---

// Request Payload Interfaces (from Pydantic models)
export interface TemplateCreate {
    name: string;
    user_id?: string; // UUID
    customer_id?: string; // UUID
    is_global?: boolean;
}

export interface TemplateRuleUpsert {
    parameter_id: string; // UUID
    custom_alias: string;
    is_active?: boolean;
    description_override?: string | null;
    ai_instructions?: string | null;
    expected_unit_override?: string | null;
}

export interface ProjectToTemplate {
    project_id: string;
    user_id: string; // UUID
    new_template_name: string;
}

// Response Interfaces (Inferred from your backend types)
/**
 * GET /extraction-templates/parameters -- the canonical parameter dictionary.
 * Typed in openapi.json as CanonicalParameter; this mirrors it exactly.
 *
 * `category` is the field decision D5 depends on: until the backend returns a
 * category with each project parameter (Task B item B4), the Parameters and
 * Review screens group by joining this dictionary on `name` == parameter_key.
 * The previous type declared a `description` field that does not exist and
 * omitted `category` entirely, so the join was impossible.
 */
export interface CanonicalParameter {
    id: string;
    name: string;
    category: string | null;
    default_description: string | null;
    expected_unit: string | null;
}

/**
 * Mirrors the ExtractionTemplateBase schema exactly. `updated_at` was declared
 * here but the backend never returns it, so any code trusting it read
 * undefined; the nullable fields are now typed as nullable rather than merely
 * optional.
 */
export interface ExtractionTemplateBase {
    id: string;
    name: string;
    user_id: string | null;
    customer_id: string | null;
    is_system_default: boolean;
    is_global: boolean;
    created_at: string;
}

export interface TemplateRule {
    id: string;
    template_id: string;
    parameter_id: string;
    /** Required by the backend schema; was missing from this type. */
    canonical_name: string;
    custom_alias: string;
    is_active: boolean;
    description_override: string | null;
    ai_instructions: string | null;
    expected_unit_override: string | null;
}

export interface TemplateWithRules extends ExtractionTemplateBase {
    rules: TemplateRule[];
}

// --- API Client Functions ---

/**
 * The backend wraps every failure as `{ "detail": "..." }`. The old wrappers
 * threw `response.statusText` ("Internal Server Error"), which told the person
 * nothing about WHY, e.g. a duplicate alias. Use the detail when there is one.
 */
async function failure(response: Response, what: string): Promise<Error> {
    let detail = '';
    try {
        const body = await response.json();
        if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
        /* not JSON; fall back to the status text */
    }
    return new Error(detail ? `${what}: ${detail}` : `${what}: ${response.statusText || response.status}`);
}

/**
 * Fetches the core dictionary of canonical parameters.
 */
export async function getParameters(): Promise<CanonicalParameter[]> {
    const response = await fetch(`${API_BASE_URL}/parameters`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw await failure(response, 'Failed to fetch parameters');
    return response.json();
}

/**
 * Creates a new empty extraction template.
 */
export async function createTemplate(data: TemplateCreate): Promise<ExtractionTemplateBase> {
    const response = await fetch(`${API_BASE_URL}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) throw await failure(response, 'Failed to create template');
    return response.json();
}

/**
 * Fetches all templates a user has access to (own, global, system).
 */
export async function getUserTemplates(userId: string): Promise<ExtractionTemplateBase[]> {
    const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw await failure(response, 'Failed to fetch user templates');
    return response.json();
}

/**
 * Fetches a complete template and all its associated parameter rules.
 */
export async function getTemplateDetails(templateId: string): Promise<TemplateWithRules> {
    const response = await fetch(`${API_BASE_URL}/${templateId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw await failure(response, 'Failed to fetch template details');
    return response.json();
}

/**
 * Inserts a new rule for a template, or updates it if the alias already exists.
 */
export async function upsertTemplateRule(
    templateId: string, 
    data: TemplateRuleUpsert
): Promise<TemplateRule> {
    const response = await fetch(`${API_BASE_URL}/${templateId}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) throw await failure(response, 'Failed to upsert template rule');
    return response.json();
}

/**
 * Deletes a template (cascades to rules automatically).
 */
export async function deleteTemplate(templateId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/${templateId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw await failure(response, 'Failed to delete template');
    // No content returned on 204
}

/**
 * Clones a project's active parameters back into a reusable template.
 */
export async function createTemplateFromProject(data: ProjectToTemplate): Promise<ExtractionTemplateBase> {
    const response = await fetch(`${API_BASE_URL}/from-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) throw await failure(response, 'Failed to create template from project');
    return response.json();
}