# Typing Analysis
_Generated: 2026-04-09_

Files reviewed: `types/index.ts`, all `components/`, `hooks/`, `contexts/`, `api/`, `app/`, `static/`, `lib/`

---

## 1. `types/index.ts` — Core Type Definitions

### 1a. `FieldType` is exported but never used
```ts
export interface FieldType { id: string; label: string; unit: string | null; }
```
Nothing in the project imports `FieldType`. It was presumably meant to type entries in `SCHEMA_GROUPS`, but that const is untyped (see §1e).
**Fix:** Either annotate `SCHEMA_GROUPS` entries with it, or delete it.

### 1b. `Specification.source` is a large inline anonymous type
The `source` property is a 9-field inline object (lines 13–25). This same shape is then approximated differently in `PDFSource`, `ExcelSource`, `DocumentViewer.Highlight`, and accessed as `any` in every viewer. A named type (`SpecificationSource`) would let all these share a single contract.

### 1c. `Specification` optional fields hide real required fields
```ts
calculated?: boolean;
rule_passed?: boolean;
rule_violations?: string[];
requires_review?: boolean;
```
These are `?` (may not exist), but the AI always sets them. Consumers like `input-field-item.tsx` access them without guarding. Meanwhile `source: {...} | null` is required-but-nullable — the opposite semantics. The optional fields should be required (non-optional) with explicit defaults to make the contract honest.

### 1d. `source_confidence` is a ghost field
```ts
source_confidence?: number | null;
```
This field is defined on `Specification` but:
- Never written in `analyze-document.ts`'s `mapSpecsToFields`
- Never read in any component
- Not mentioned in any API response mapping

It is dead weight that will confuse anyone reading the type.

### 1e. `SCHEMA_GROUPS` has no explicit type annotation
The constant is inferred as a wide array literal. TypeScript does not enforce that each entry matches `FieldType`. If `FieldType` is the intended shape, add `satisfies` or a type annotation:
```ts
export const SCHEMA_GROUPS: { group: string; fields: FieldType[] }[] = [...]
```

### 1f. `InputField.type` duplicates `InputField.id`
In every place `InputField` objects are created (`generateDefaultFields`, `mapSpecsToFields`, `hydrateFieldsFromDB`), `type` is always set to the same value as `id`:
```ts
{ id: fieldId, type: fieldId, ... }
```
`type` is never used for anything `id` doesn't already cover. It's a redundant field.

### 1g. `PDFSource` declares required fields that are nullable at runtime
```ts
export interface PDFSource {
  boundingBox: { x: number; y: number; width: number; height: number }; // required
  pageNumber: number;                                                    // required
  textSnippet: string;                                                   // required
}
```
`PdfViewer` guards `if (!activeHighlight.boundingBox)` and renders the text snippet conditionally, proving these can be absent. The interface is a lie — these should be nullable.

### 1h. `ExcelSource` is missing fields used at runtime
```ts
export interface ExcelSource {
  documentId: string;
  tableName: string;
  cellCoordinates: { row: number; column: number };
}
```
`ExcelViewer` reads `activeHighlight.pageNumber`, `activeHighlight.boundingBox`, and `activeHighlight.textSnippet` — none of which are in `ExcelSource`. The interface understates what this shape actually carries.

### 1i. `PDFSource`/`ExcelSource` vs `Specification.source` — no declared relationship
The inline `source` type on `Specification` (lines 13–25) carries almost all the same fields as `PDFSource` and `ExcelSource` combined, but there is no union or inheritance. The three types evolve independently and have already drifted (e.g., `PDFSource` has no `reason` or `textSnippet: string | null`, the inline has `textSnippet: string | null`).

**Suggested structure:**
```ts
export interface SpecificationSource {
  documentId: string | null;
  textSnippet: string | null;
  reason: string | null;
  pageNumber: number | null;
  boundingBox: BoundingBox | null;
  tableName: string | null;
  cellCoordinates: { row: number; column: number } | null;
}

export interface PDFSource extends Pick<SpecificationSource, 'documentId' | 'pageNumber' | 'boundingBox' | 'textSnippet'> { ... }
export interface ExcelSource extends Pick<SpecificationSource, 'documentId' | 'tableName' | 'cellCoordinates'> { ... }
```

---

## 2. Component Props — `any` Overuse

### 2a. `DocumentRouter`, `PdfViewer`, `ExcelViewer` — `activeHighlight: any`
All three viewer props type `activeHighlight` as `any`:
```ts
// DocumentRouter.tsx:12
activeHighlight: any;

// PdfViewer.tsx:17
activeHighlight: any;

// ExcelViewer.tsx:19
activeHighlight?: any;
```
This is the most impactful typing gap in the project. Accessing `.boundingBox`, `.pageNumber`, `.textSnippet`, `.cellCoordinates` on `any` gives zero type safety. A discriminated union or a shared `ActiveHighlight` type would cover all three cases:
```ts
type ActiveHighlight = PDFSource | ExcelSource | null;
```

### 2b. `InputFieldItemProps.onShowSource: (source: any) => void`
`input-field-item.tsx:26` — called with `displaySource` (which is `Specification['source']`), but typed as `any`. This cascades from `InputFieldsListProps.onShowSource: (source: any) => void` (`input-fields-list.tsx:19`) through to the page-level `handleJumpToSource`.

### 2c. `InputFieldItem` accesses non-existent fields on `InputField`
```ts
// input-field-item.tsx:46-47
const [isFlagged, setIsFlagged] = useState(field.isFlagged || false);
const [flagReason, setFlagReason] = useState(field.flagReason || '');
```
`InputField` has no `isFlagged` or `flagReason` field. TypeScript would catch this in strict mode. As-is, these always initialize to `false`/`''` and the flag state is purely local — it won't survive re-renders caused by parent state updates.
**Fix:** Either add these fields to `InputField`, or remove the `field.isFlagged` initialization and rely solely on local state.

### 2d. `onChange` signature mismatch between `InputFieldItem` and `InputFieldsList`
```ts
// input-field-item.tsx:24
onChange: (id: string, value: string, unit: string) => void;  // 3 params

// input-fields-list.tsx:17
onFieldChange: (id: string, value: string) => void;           // 2 params
```
`InputFieldsList` passes `onFieldChange` as `onChange` to `InputFieldItem`. The `unit` parameter is silently dropped. Additionally, `ParameterManager.handleFieldChange` only accepts `(fieldId, value)` — it does not handle units. **The unit change in the text field does nothing.** This is a silent functional bug caused by inconsistent signatures.

### 2e. `Sidebar.tsx` — `file: any` in document map
```ts
activeFiles.map((file: any) => { ... })  // line 191
```
All file properties (`file.id`, `file.name`) are accessed without any type contract. Since `activeFiles` comes from `currentProject?.files || currentProject?.documents` (also `any`), the entire chain is untyped.

---

## 3. Context Types

### 3a. `ProjectContext` — `projects: any[]`, `currentProject: any | null`
Previously noted. Downstream effects include:
- `bda/page.tsx:84` — `currentProject.alias_id || currentProject.title || currentProject.name` (speculative chain of maybe-properties)
- `bda/page.tsx:116` — `projects[0].id` (untyped)
- `Sidebar.tsx:134-135` — `project.id`, `project.alias_id || project.name` (untyped)

A `Project` interface should be declared (mirroring the backend) and used throughout.

### 3b. `bda/page.tsx:150` — `as any` to bypass type mismatch
```ts
await createNewProject({ alias_id: ..., title: ... } as any);
```
`title` is not in `ProjectCreateInput`. The cast silences a real type error indicating a backend contract inconsistency. Either `title` should be added to `ProjectCreateInput` or the backend endpoint should be updated to remove the need for it.

### 3c. `bda/page.tsx` — `pendingPartialRef: useRef<any[] | null>`
```ts
const pendingPartialRef = useRef<any[] | null>(null);
```
This ref holds `InputField[]` but is typed `any[]`. It's then cast `as any` when passed to `handlePopulateExtractedData`. Should be `useRef<InputField[] | null>(null)`.

---

## 4. API Types

### 4a. `ParameterInput.final_value: number | null` vs actual usage of `string`
```ts
// api/projects.ts:15
export interface ParameterInput {
  final_value: number | null;
  ...
}
```
In `handleSave` (`bda/page.tsx:166`):
```ts
final_value: activeSpec?.value || null,  // activeSpec.value is string
```
`Specification.value` is `string`. This passes a `string` where `number | null` is expected. TypeScript won't catch this without strict checking because `||` returns a truthy string. This is a **silent type bug** — the backend receives strings in a numeric field.
**Fix:** Parse the value: `final_value: activeSpec?.value ? Number(activeSpec.value) : null`.

### 4b. `err: any` pattern repeated across all contexts
```ts
} catch (err: any) {
  setError(err.message || '...')
}
```
This pattern appears in `ProjectContext`, `DocumentManager`, and `Sidebar`. `catch (err: unknown)` is stricter and forces a type guard before accessing `.message`.

---

## 5. Duplicate / Dead Type Definitions

### 5a. `DocumentViewer.tsx` defines a local `Highlight` interface — component appears unused
```ts
// DocumentViewer.tsx:31-35
interface Highlight {
  pageNumber: number;
  boundingBox: [number, number, number, number]; // tuple
  textSnippet?: string;
}
```
This is a third, incompatible definition of the highlight shape (tuple vs object vs `any`). `DocumentViewer` itself is not imported or rendered anywhere in the current routing — it appears to be superseded by `PdfViewer` + `DocumentRouter`. The file (and its local `Highlight` type) may be dead code.

### 5b. `BoundingBox` is defined inline three times
The shape `{ x: number; y: number; width: number; height: number }` appears in:
- `Specification.source.boundingBox` inline
- `PDFSource.boundingBox`
- `getHighlightStyle` in `PdfViewer` (implicit, accessed as `bbox.x`, `bbox.y`, etc.)

It should be a named exported type: `export type BoundingBox = { x: number; y: number; width: number; height: number }`.

### 5c. `analyze-document.ts` maps `label: fieldId` — loses display labels
```ts
// analyze-document.ts:58-59
extractedFields.push({ id: fieldId, type: fieldId, label: fieldId, ... });
```
`label` is set to the raw ID string (e.g., `'U_MIN'`), not the human-readable label from `SCHEMA_GROUPS`. `handlePopulateExtractedData` merges by `id` so the label is overwritten on the merge — but if any code path displays AI-returned `InputField` objects before the merge, labels will be raw IDs.

---

## 6. Missing Types Across API Layer

All three API files (`upload-doc.ts`, `chat.ts`, `analyze-document.ts`) return `any` or `Promise<any>`:

| File | Function | Return Type |
|---|---|---|
| `upload-doc.ts` | `uploadDocuments` | `Promise<any>` |
| `chat.ts` | `sendMessage` | implicit `Promise<any>` |
| `analyze-document.ts` | `analyzeDocument` | `Promise<InputField[]>` ✓ |
| `projects.ts` | All functions | implicit `Promise<any>` |

`analyzeDocument` is the only API function with a typed return. The others should have explicit return type interfaces.

---

## Priority Summary

| Severity | Issue | Location |
|---|---|---|
| **High** | `ParameterInput.final_value` is `number` but callers pass `string` — silent API bug | `bda/page.tsx:166`, `api/projects.ts:15` |
| **High** | `onChange` signature mismatch — unit changes are silently dropped | `input-field-item.tsx:24` vs `input-fields-list.tsx:17` |
| **High** | `activeHighlight: any` in all viewer props — zero safety on a core data flow | `DocumentRouter`, `PdfViewer`, `ExcelViewer` |
| **High** | `InputFieldItem` accesses `field.isFlagged`/`field.flagReason` which don't exist on `InputField` | `input-field-item.tsx:46-47` |
| **Medium** | `PDFSource` / `ExcelSource` don't match runtime usage — fields missing or wrong nullability | `types/index.ts:92-103` |
| **Medium** | `ProjectContext.projects`/`currentProject` typed as `any` — cascades through entire app | `contexts/ProjectContext.tsx` |
| **Medium** | `source_confidence` ghost field on `Specification` | `types/index.ts:28` |
| **Medium** | `BoundingBox` type defined inline 3× — no shared definition | Multiple files |
| **Medium** | `Specification.source` inline type vs `PDFSource`/`ExcelSource` — no declared relationship | `types/index.ts` |
| **Low** | `FieldType` exported but never used | `types/index.ts:1` |
| **Low** | `InputField.type` always equals `InputField.id` — redundant field | `types/index.ts:35-40` |
| **Low** | `pendingPartialRef: any[] | null` should be `InputField[] | null` | `bda/page.tsx:65` |
| **Low** | `SCHEMA_GROUPS` has no explicit type annotation | `types/index.ts:42` |
| **Low** | `as any` cast used to bypass `ProjectCreateInput` mismatch (`title` field) | `bda/page.tsx:150` |
| **Low** | `catch (err: any)` repeated — `unknown` is stricter | All contexts and Sidebar |
| **Low** | `DocumentViewer.tsx` appears to be dead code with its own incompatible `Highlight` type | `components/DocumentViewer/DocumentViewer.tsx` |
| **Low** | All `api/` functions except `analyzeDocument` have untyped return values | `api/*.ts` |
