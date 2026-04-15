# Code Analysis: contexts/ and hooks/
_Generated: 2026-04-09_

---

## Summary

Analyzed `AuthContext.tsx`, `ProjectContext.tsx`, `DocumentManager.tsx`, and `ParameterManager.tsx`, cross-referenced against `api/`.

---

## 1. Cross-Cutting: Inconsistent API URL Handling

**The biggest systemic issue.** Every file uses a different strategy for the base URL:

| File | Strategy |
|---|---|
| `contexts/AuthContext.tsx:6` | Hardcoded `'http://localhost:8000/auth'` |
| `hooks/DocumentManager.tsx:34` | Hardcoded `'http://localhost:8000'` inside `hydrateFiles` |
| `api/projects.ts:3` | Hardcoded `'http://localhost:8000/projects'` |
| `api/upload-doc.ts:1` | `process.env.API_URL \|\| 'http://localhost:8000'` ✓ |
| `api/chat.ts:3` | `process.env.API_URL \|\| 'http://localhost:8000'` ✓ |
| `api/analyze-document.ts:4` | `process.env.API_URL \|\| 'http://localhost:8000'` ✓ |

**Recommendation:** Consolidate into a single shared constant, e.g. `lib/api-config.ts`, and import it everywhere.

---

## 2. AuthContext.tsx

### 2a. `logout()` referenced before declaration (code smell)
`useEffect` (line 30) calls `logout()` inside `validateSession()`, but `logout` is declared at line 98.
This works at runtime because effects run after the full render, but it's confusing to read and fragile under refactoring.
**Fix:** Move `logout` above the `useEffect`, or use a ref.

### 2b. Missing `logout` in `useEffect` dependency array
`validateSession` calls `logout`, which is not listed in `useEffect`'s `[]` deps. ESLint exhaustive-deps will flag this.
**Fix:** Either add `logout` to the dep array (after wrapping it in `useCallback`) or restructure to inline the cleanup logic.

### 2c. No error state exposed
`AuthContextType` exposes `isLoading` but not an `error`. Session validation errors are only `console.error`'d and swallowed. The `login()` function throws, which means every consumer must try/catch. Compare with `ProjectContext` which has a uniform `error: string | null` pattern.
**Fix:** Add `error: string | null` and `clearError` to `AuthContextType` for consistency.

### 2d. Username sent as GET query parameter
Both `validateSession` and `login` use `GET /auth/user?username=...`. Usernames appear in browser history, server access logs, and referrer headers.
**Fix:** Use `POST` with a JSON body, or at minimum validate that this is intentional on the backend.

### 2e. Auth model is identity lookup, not session validation
`validateSession` re-fetches user data by username from localStorage. Since there's no token/cookie/session, the "re-verify" is just checking if the user still exists, not that this browser session is authorized. Any user who knows another username could set `bda_user` in localStorage and be "logged in" as that person.
**Note:** This may be acceptable for an internal tool, but worth flagging.

---

## 3. ProjectContext.tsx

### 3a. `useEffect` missing `fetchUserProjects` in dependency array
```tsx
useEffect(() => {
  if (user?.id) {
    fetchUserProjects(); // fetchUserProjects not in deps
  }
  ...
}, [user?.id]); // line 47
```
`fetchUserProjects` is a `useCallback` that itself depends on `user?.id`, so practically there's no bug here, but ESLint will warn and it's technically a stale closure.
**Fix:** Add `fetchUserProjects` to the dep array.

### 3b. `isLoading` flickers in `createNewProject`
`createNewProject` (line 78) calls `fetchUserProjects()` then `loadProjectDetails()` sequentially. Each has its own `setIsLoading(false)` in a `finally` block. The loading state goes: `true → false → true → false`. This causes a UI flicker.
**Fix:** Hoist the loading guard — do a single `setIsLoading(true)` before both calls and a single `setIsLoading(false)` after both complete.

### 3c. Ambiguous `createNewProject` response shape
Line 90: `const newProjectId = response?.project?.id || response?.id;`
This defensive double-path indicates the shape of `apiCreateProject`'s response is not known. If the backend changes, this silently fails.
**Fix:** Type `apiCreateProject`'s return value so the shape is explicit.

### 3d. Pervasive `any` types
`projects: any[]` and `currentProject: any | null` in both the state and the context interface. TypeScript provides no safety for any code that accesses project properties.
**Fix:** Define a `Project` interface mirroring the backend schema and replace `any`.

### 3e. `addContributor` and `saveParameters` depend on `currentProject` object
```tsx
const addContributor = useCallback(async (...) => {
  if (currentProject?.id === projectId) { ... }
}, [currentProject, loadProjectDetails]); // line 118
```
The entire `currentProject` object is a dependency, so the callback re-creates any time any field of `currentProject` changes — not just its `id`. This causes unnecessary re-renders in consumers.
**Fix:** Use `currentProject?.id` extracted into a variable, or use a ref for comparison.

### 3f. `console.log` left in production code
`saveParameters` line 123: `console.log("Saving parameters:", parameters);`

---

## 4. DocumentManager.tsx (hooks/)

### 4a. Potential crash on empty upload response
```tsx
setActiveFileId(newFiles[0].id); // line 81
```
If `response.successful_uploads` is non-null but empty (all files failed), `newFiles` is empty and `newFiles[0]` throws a `TypeError`.
**Fix:** `if (newFiles.length > 0) setActiveFileId(newFiles[0].id);`

### 4b. File extension check is missing the dot
Line 75:
```tsx
originalFile.name.endsWith('pdf')  // BUG: matches "notapdf", "sumpdf", etc.
```
Should be `.endsWith('.pdf')`.

### 4c. `hydrateFiles` MIME type defaults to Excel for everything non-PDF
Line 49: `doc.type === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel'`
Any document type other than `'pdf'` gets labeled as Excel (`.xls`). If future file types are added (e.g., CSV, DOCX), they'll be routed to the wrong viewer.
**Fix:** Map more explicitly, or keep the raw MIME type from the backend.

### 4d. Blob URL leak when `hydrateFiles` is called more than once
`hydrateFiles` creates `URL.createObjectURL(blob)` entries (line 50) but does not revoke the previous set before overwriting state. `clearFiles` revokes them, but only if the caller remembers to call `clearFiles` before `hydrateFiles`.
**Fix:** Inside `hydrateFiles`, revoke existing blob URLs in state before setting new ones (same pattern used in `clearFiles`).

### 4e. `handleDocumentUpload` not wrapped in `useCallback`
All other functions in this hook use `useCallback`, but `handleDocumentUpload` (line 64) does not. Callers will receive a new reference on every render.

### 4f. `console.log` left in production code
`handleJumpToSource` line 98: `console.log('Active Source: ', source)`

### 4g. No error state exposed
Both `handleDocumentUpload` and `hydrateFiles` catch errors and only `console.error` them. Consumers have no way to know an upload or hydration failed.
**Fix:** Add `error: string | null` to the returned state.

---

## 5. ParameterManager.tsx (hooks/)

### 5a. `hydrateFieldsFromDB` builds incomplete `Specification` objects
The `dbSpec` built on lines 50–59 is missing fields that the `Specification` type almost certainly requires:
- `calculated`
- `rule_passed`
- `rule_violations`
- `requires_review`

If any component accesses these fields, it will get `undefined` instead of a safe default, causing potential rendering bugs.
**Fix:** Add default values: `calculated: false, rule_passed: true, rule_violations: [], requires_review: false`.

### 5b. Same issue in `handleFieldChange` for manually created specs
Line 32:
```tsx
const newSpec = { id: newSpecId, value, confidence: null, unit: null, source: null };
```
Also missing `calculated`, `rule_passed`, `rule_violations`, `requires_review`.

### 5c. `hydrateFieldsFromDB` and `handlePopulateExtractedData` are inconsistent approaches
- `hydrateFieldsFromDB`: replaces specs with exactly 1 DB-sourced spec, no multi-candidate support.
- `handlePopulateExtractedData`: merges multiple AI candidate specs, sorts by confidence, auto-selects best.

If a project is loaded from the DB and then re-analyzed, the DB hydration will have discarded all the original candidates. If there was previously more than one candidate per field, that data is lost.
**Fix:** Decide on one canonical data model. If multi-candidate is important, the DB hydration should also reconstruct multiple candidates (requires backend support).

### 5d. `console.log` left in production code
`hydrateFieldsFromDB` line 42: `console.log("Hydrating fields from DB parameters:", dbParameters);`

### 5e. Inconsistent indentation
`resetFields` (lines 83–85) is indented differently from all other functions in the hook.

---

## 6. api/analyze-document.ts (bonus finding)

### Unused import
Line 2: `import { v4 as uuidv4 } from 'uuid';`
`uuidv4` is imported but never called anywhere in the file. Dead import.

---

## Priority Summary

| Severity | Issue |
|---|---|
| **High** | Inconsistent API URLs — app will break in any non-localhost env |
| **High** | `DocumentManager` crash on empty upload (`newFiles[0].id`) |
| **High** | Incomplete `Specification` objects in `hydrateFieldsFromDB` and `handleFieldChange` |
| **Medium** | `isLoading` flicker in `createNewProject` |
| **Medium** | Blob URL leak in `hydrateFiles` |
| **Medium** | Auth model has no real session token — trivially spoofable via localStorage |
| **Medium** | Pervasive `any` types in `ProjectContext` |
| **Low** | Multiple `console.log`/`console.error` statements left in production paths |
| **Low** | Missing `useCallback` on `handleDocumentUpload` |
| **Low** | `endsWith('pdf')` missing dot |
| **Low** | Unused `uuidv4` import in `analyze-document.ts` |
| **Low** | Missing deps in `useEffect` / `useCallback` arrays (ESLint warnings) |
