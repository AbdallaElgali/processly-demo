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
    description_override?: string;
    ai_instructions?: string;
    expected_unit_override?: string;
}

export interface ProjectToTemplate {
    project_id: string;
    user_id: string; // UUID
    new_template_name: string;
}

// Response Interfaces (Inferred from your backend types)
export interface CanonicalParameter {
    id: string;
    name: string;
    description?: string;
    expected_unit?: string;
    // ... add other fields based on your DB schema
}

export interface ExtractionTemplateBase {
    id: string;
    name: string;
    user_id?: string;
    customer_id?: string;
    is_global: boolean;
    created_at: string; // ISO Date string
    updated_at: string; // ISO Date string
}

export interface TemplateRule {
    id: string;
    template_id: string;
    parameter_id: string;
    custom_alias: string;
    is_active: boolean;
    description_override?: string;
    ai_instructions?: string;
    expected_unit_override?: string;
}

export interface TemplateWithRules extends ExtractionTemplateBase {
    rules: TemplateRule[];
}

// --- API Client Functions ---

/**
 * Fetches the core dictionary of canonical parameters.
 */
export async function getParameters(): Promise<CanonicalParameter[]> {
    const response = await fetch(`${API_BASE_URL}/parameters`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`Failed to fetch parameters: ${response.statusText}`);
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

    if (!response.ok) throw new Error(`Failed to create template: ${response.statusText}`);
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

    if (!response.ok) throw new Error(`Failed to fetch user templates: ${response.statusText}`);
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

    if (!response.ok) throw new Error(`Failed to fetch template details: ${response.statusText}`);
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

    if (!response.ok) throw new Error(`Failed to upsert template rule: ${response.statusText}`);
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

    if (!response.ok) throw new Error(`Failed to delete template: ${response.statusText}`);
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

    if (!response.ok) throw new Error(`Failed to create template from project: ${response.statusText}`);
    return response.json();
}