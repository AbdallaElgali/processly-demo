/**
 * The single confidence threshold (RFC 4.1, plan-A 1.4). The backend's scale
 * is 0-1; the UI's `Specification.confidence` is 0-100 (converted at the API
 * boundary in lib/parameter-adapter.ts), so this is expressed on the UI scale.
 */
export const CONFIDENCE_HIGH = 85;

export function isHighConfidence(confidence: number | null | undefined): boolean {
  return confidence !== null && confidence !== undefined && confidence >= CONFIDENCE_HIGH;
}
