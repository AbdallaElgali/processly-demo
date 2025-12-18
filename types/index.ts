export interface FieldType {
  id: string;
  label: string;
  unit: string | null;
}
export interface InputField {
  id: string;
  type: string;
  label: string;
  value: string;
  confidence: number | null;

  source: {
            pageNumber: number | null;
            textSnippet: string | null;
            boundingBox: { x: number; y: number; width: number; height: number } | null;
            reason: string | null;
          } | null;

  calculated?: boolean;
  source_confidence?: number | null;
  rule_passed?: boolean;
  rule_violations?: string[];
  requires_review?: boolean;
}