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
  source: string | null;
  calculated?: boolean;
  source_confidence?: number | null;
  rule_passed?: boolean;
  rule_violations?: string[];
  requires_review?: boolean;
}