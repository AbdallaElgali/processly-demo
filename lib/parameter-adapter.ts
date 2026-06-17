// Single source of truth for translating between the backend parameter/candidate
// shapes and the UI `InputField`/`Specification` model. Every DB<->UI conversion
// lives here so the rules (identity, confidence scale, flag mapping) can never
// drift between the analyze stream, hydration, and save paths.

import { v4 as uuidv4 } from 'uuid';
import {
  InputField,
  Specification,
  SpecificationSource,
  ReviewAction,
  SCHEMA_GROUPS,
} from '@/types';
import { ProjectParameter, ParameterInput } from '@/api/projects';

// Flat lookup: parameter_key -> display label
const FIELD_LABEL_MAP = new Map(
  SCHEMA_GROUPS.flatMap(g => g.fields.map(f => [f.id, f.label] as const))
);

// Backend confidence is on a 0–1 scale; the UI works in 0–100.
const toUiConfidence = (c: unknown): number | null =>
  c === null || c === undefined ? null : Number(c) * 100;

export const toBackendConfidence = (c: number | null): number | null =>
  c === null ? null : c / 100;

// --- Bounding box helpers ---------------------------------------------------

// Normalize an arbitrary backend bounding box to the UI's {x, y, width, height}.
export const formatBoundingBox = (bbox: unknown) => {
  if (!bbox || typeof bbox !== 'object') return null;
  const b = bbox as Record<string, unknown>;
  if ('x0' in b && 'x1' in b) {
    return {
      x: b.x0 as number,
      y: b.y0 as number,
      width: (b.x1 as number) - (b.x0 as number),
      height: (b.y1 as number) - (b.y0 as number),
    };
  }
  if (Array.isArray(bbox) && bbox.length === 4) {
    return { x: bbox[0], y: bbox[1], width: bbox[2] - bbox[0], height: bbox[3] - bbox[1] };
  }
  if ('width' in b) return b as { x: number; y: number; width: number; height: number };
  return null;
};

// Convert {x, y, width, height} BACK to the backend {x0, y0, x1, y1}.
const reverseFormatBoundingBox = (bbox: unknown) => {
  if (!bbox || typeof bbox !== 'object') return null;
  const b = bbox as Record<string, unknown>;
  if ('width' in b && 'height' in b) {
    return {
      x0: b.x as number,
      y0: b.y as number,
      x1: (b.x as number) + (b.width as number),
      y1: (b.y as number) + (b.height as number),
    };
  }
  return b;
};

// --- Candidate -> Specification --------------------------------------------

// Handles BOTH the SSE stream item shape (camelCase / nested `source`,
// `value`, `id`) and the persisted AiMetricCandidate shape (snake_case /
// flat `source_*`, `ai_value`). A single mapper guarantees they stay aligned.
const candidateToSpecification = (item: Record<string, unknown>): Specification => {
  const src = (item.source as Record<string, unknown>) || item;
  const candidateId = (item.id as string) ?? null;
  return {
    id: candidateId ?? uuidv4(),
    candidateId,
    value:
      item.value !== null && item.value !== undefined
        ? String(item.value)
        : item.ai_value !== null && item.ai_value !== undefined
          ? String(item.ai_value)
          : '',
    unit: (item.unit as string) || (item.expected_unit as string) || '',
    confidence: toUiConfidence(item.confidence),
    source: {
      documentId: (src.documentId as string) || (src.source_document_id as string) || null,
      pageNumber: (src.pageNumber as number) ?? (src.source_page_number as number) ?? null,
      textSnippet: (src.textSnippet as string) || (src.source_text_snippet as string) || null,
      reason:
        (src.reason as string) ||
        (src.source_reason as string) ||
        (item.calculation_logic as string) ||
        null,
      boundingBox: formatBoundingBox(src.boundingBox || src.source_bounding_box),
      tableName: (src.tableName as string) || (src.source_table_name as string) || null,
      cellCoordinates:
        (src.cellCoordinates as { row: number; column: number }) ||
        (src.source_cell_coordinates as { row: number; column: number }) ||
        null,
    },
    calculated: (item.is_calculated as boolean) || (item.calculated as boolean) || false,
    rule_passed: !item.rule_violations || (item.rule_violations as unknown[]).length === 0,
    rule_violations: (item.rule_violations as string[]) || [],
    requires_review: (item.requires_review as boolean) || false,
  };
};

// Fallback source built from the param-level joined fields when a parameter has
// no candidates (purely human-entered or legacy rows).
const paramLevelSource = (p: ProjectParameter): SpecificationSource => ({
  documentId: null,
  textSnippet: p.source_text_snippet ?? null,
  reason: null,
  pageNumber: p.source_page_number ?? null,
  boundingBox: null,
  tableName: null,
  cellCoordinates: null,
});

// --- DB -> UI ---------------------------------------------------------------

export const dbParamToInputField = (p: ProjectParameter): InputField => {
  const base = {
    id: p.parameter_key,
    dbId: p.id,
    label: FIELD_LABEL_MAP.get(p.parameter_key) ?? p.parameter_key,
    isFlagged: !!p.human_flagged,
    flagReason: p.flag_reason ?? null,
    activeFlagId: p.active_flag_id ?? null,
    reviewAction: ((p.review_action as ReviewAction) || 'PENDING') as ReviewAction,
  };

  const specifications = (p.candidates ?? []).map(c =>
    candidateToSpecification(c as unknown as Record<string, unknown>)
  );

  // The backend marks one candidate as selected (defaults to the first on save).
  const selected =
    specifications.find(s => s.candidateId === p.selected_candidate_id) ?? specifications[0];

  const hasFinal = p.final_value !== null && p.final_value !== undefined;

  if (hasFinal) {
    const finalValue = String(p.final_value);
    const finalUnit = p.final_unit ?? '';

    if (selected) {
      // A human edit diverges the saved value from the AI candidate. Surface the
      // saved value on the selected spec while keeping every candidate as an
      // alternative. Otherwise trust the candidate's own value and confidence.
      if (p.is_human_modified) {
        const edited: Specification = { ...selected, value: finalValue, unit: finalUnit, confidence: null };
        return {
          ...base,
          specifications: specifications.map(s => (s.id === edited.id ? edited : s)),
          selectedSpecId: edited.id,
        };
      }
    } else {
      // No candidates but a value exists -> represent it as a single human spec.
      const humanSpec: Specification = {
        id: uuidv4(),
        candidateId: p.selected_candidate_id ?? null,
        value: finalValue,
        unit: finalUnit,
        confidence: null,
        source: paramLevelSource(p),
        calculated: false,
        rule_passed: true,
        rule_violations: [],
        requires_review: false,
      };
      return { ...base, specifications: [humanSpec], selectedSpecId: humanSpec.id };
    }
  }

  return { ...base, specifications, selectedSpecId: selected?.id };
};

// --- UI -> DB (save) --------------------------------------------------------

export const inputFieldToParameterInput = (
  f: InputField,
  userId: string | null
): ParameterInput => {
  const activeSpec = f.specifications.find(s => s.id === f.selectedSpecId) ?? f.specifications[0];
  const parsed = activeSpec?.value ? Number(activeSpec.value) : null;
  return {
    parameter_key: f.id,
    final_value: parsed !== null && !isNaN(parsed) ? parsed : null,
    final_unit: activeSpec?.unit || null,
    is_human_modified: f.reviewAction === 'MODIFIED',
    selected_candidate_id: activeSpec?.candidateId ?? null,
    flag: f.isFlagged,
    flag_reason: f.isFlagged ? f.flagReason : null,
    flagger_id: f.isFlagged ? userId : null,
    review_action: f.reviewAction,
  };
};

// --- Stream -> UI -----------------------------------------------------------

const schemaLabelMap: Record<string, string> = Object.fromEntries(
  SCHEMA_GROUPS.flatMap(g => g.fields.map(f => [f.id, f.label]))
);

// Maps the raw spec map streamed from /specs/stream-specs into transient
// InputFields. Only `id` and `specifications` are consumed downstream by
// handlePopulateExtractedData, so the flag/review fields are placeholders.
export const specsStreamToInputFields = (rawSpecs: Record<string, unknown>): InputField[] => {
  const extractedFields: InputField[] = [];

  Object.keys(rawSpecs).forEach((fieldId: string) => {
    const metricsArray = rawSpecs[fieldId];
    if (!Array.isArray(metricsArray) || metricsArray.length === 0) return;

    extractedFields.push({
      id: fieldId,
      dbId: '', // transient — handlePopulateExtractedData only reads specifications
      label: schemaLabelMap[fieldId] ?? fieldId,
      specifications: metricsArray.map((item: Record<string, unknown>) =>
        candidateToSpecification(item)
      ),
      isFlagged: false,
      flagReason: null,
      activeFlagId: null,
      reviewAction: 'PENDING',
    });
  });

  return extractedFields;
};

// --- UI -> backend specs (re-analysis `previous_specs`) ---------------------

// Converts UI fields back to the backend VoltavisionSpecs schema so flagged
// parameters can be sent for iterative correction.
export const mapFieldsToSpecs = (
  fields: InputField[] | undefined
): Record<string, unknown> | null => {
  if (!fields) return null;
  const specs: Record<string, unknown> = {};
  let hasData = false;

  fields.forEach(field => {
    if (field.specifications && field.specifications.length > 0) {
      hasData = true;
      specs[field.id] = field.specifications.map(spec => {
        const backendSource = spec.source
          ? { ...spec.source, boundingBox: reverseFormatBoundingBox(spec.source.boundingBox) }
          : null; 
        const val: number | null = (spec.value === '' || spec.value == null) 
          ? null 
          : Number(spec.value);  //!!!EJIFJIEFIOPEJFS FOUND IT!!!!
        return {
          // Send the real candidate id; omit it for human-entered specs so
          // Pydantic's default_factory generates a valid UUID (sending null 422s).
          ...(spec.candidateId ? { id: spec.candidateId } : {}),
          value: val,
          unit: spec.unit,
          confidence: toBackendConfidence(spec.confidence),
          source: backendSource,
          is_flagged: field.isFlagged || false,
          flag_reason: field.flagReason || '',
          active_flag_id: field.activeFlagId || null,
        };
      });
    } else if (field.isFlagged) {
      // Flagged fields with no extracted value still need to reach the backend so
      // iterative extraction knows to target them. Omit `id` so Pydantic generates one.
      hasData = true;
      specs[field.id] = [
        {
          value: null,
          unit: null,
          confidence: null,
          source: null,
          is_flagged: true,
          flag_reason: field.flagReason || '',
          active_flag_id: field.activeFlagId ?? null,
        },
      ];
    }
  });

  return hasData ? specs : null;
};
