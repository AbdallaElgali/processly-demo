# Capturing `project_parameter_id` on the frontend

_Branch: `dynamic-parameters`. Written 2026-08-02._

## TL;DR

The id is **already captured** on hydration — `InputField.dbId` (`types/index.ts:42`) is set from
`ProjectParameter.id` in `dbParamToInputField` (`lib/parameter-adapter.ts:123`). The only thing
missing is that the save mapper never emits it. Right now the repo has **exactly one** type error:

```
lib/parameter-adapter.ts(187,3): error TS2741: Property 'project_parameter_id' is missing in type
'{ parameter_key: string; final_value: number | null; ... }' but required in type 'ParameterInput'.
```

Step 1 below is the one-line fix that closes it. Steps 2–6 are the work that makes it *stay* correct
— right now nothing prevents a field with an empty `dbId` from being sent, and the guarantee that it
can't happen is accidental rather than enforced.

---

## Step 1 — Emit `project_parameter_id` in the save mapper (required)

`lib/parameter-adapter.ts:186-198`, in `inputFieldToParameterInput`:

```ts
  return {
    parameter_key: f.id,
    project_parameter_id: f.dbId,   // <-- add
    final_value: parsed !== null && !isNaN(parsed) ? parsed : null,
    ...
  };
```

That alone makes the build pass and makes every save path carry the id, because all three save call
sites already funnel through this one function:

| Call site | Path |
|---|---|
| `app/bda/page.tsx:71` (`persistFields`) | silent auto-save on flag |
| `app/bda/page.tsx:126` (`handleSave`) | explicit Save button |
| `app/review/page.tsx:66` (`persistFields`) | review-mode flag auto-save |

---

## Step 2 — Make a missing id impossible to send silently

There are only **two** places in the codebase that construct an `InputField`:

1. `dbParamToInputField` (`lib/parameter-adapter.ts:120`) — `dbId: p.id` ✅ real id.
2. `specsStreamToInputFields` (`lib/parameter-adapter.ts:209`) — `dbId: ''` ❌ placeholder, built from
   the SSE analyze stream.

Path 2 does **not** currently leak an empty id into state, but only by accident:
`handlePopulateExtractedData` (`hooks/ParameterManager.tsx:86-104`) merges the streamed field into the
existing one with `{ ...updatedFields[idx], specifications, selectedSpecId }`, so the hydrated `dbId`
survives, and `idx === -1` (a streamed key with no DB row) is dropped entirely. Two things to do:

**2a. Delete the fake `dbId` by giving the stream its own type.** In `types/index.ts`:

```ts
// What the analyze stream produces: a patch against an existing InputField.
// It has no DB identity of its own — the ProjectParameter row is the source of that.
export interface ExtractedFieldPatch {
  id: string;                        // parameter_key
  label: string;
  specifications: Specification[];
}
```

Then change `specsStreamToInputFields` to return `ExtractedFieldPatch[]` (drop the `dbId: ''`,
`isFlagged`, `flagReason`, `activeFlagId`, `reviewAction` placeholders at
`lib/parameter-adapter.ts:216-227`), and widen the signatures of `handlePopulateExtractedData`
(`hooks/ParameterManager.tsx:86`), `analyzeDocument`'s `onProgress`/return
(`api/analyze-document.ts:12,13`), and `useAnalyze` (`hooks/useAnalyze.ts:11,16`) to match. Nothing
downstream reads the placeholder fields, so this is a pure deletion.

**2b. Surface dropped keys.** In `handlePopulateExtractedData`, the `idx === -1` branch is currently
silent. On the dynamic-parameters branch that means "the AI extracted a parameter_key that has no
`ProjectParameter` row for this project's template" — a real mismatch worth seeing:

```ts
const idx = updatedFields.findIndex(f => f.id === incomingField.id);
if (idx === -1) {
  console.warn(`[params] extracted "${incomingField.id}" has no project parameter row — dropped`);
  return;
}
```

**2c. Guard the save boundary.** Add one helper to `lib/parameter-adapter.ts` and use it at all three
call sites (this also dedupes the identical `.map()` currently written out three times):

```ts
export const fieldsToParameterInputs = (
  fields: InputField[],
  userId: string | null
): ParameterInput[] => {
  const missing = fields.filter(f => !f.dbId);
  if (missing.length) {
    console.error('[params] skipping fields with no project_parameter_id:', missing.map(f => f.id));
  }
  return fields.filter(f => f.dbId).map(f => inputFieldToParameterInput(f, userId));
};
```

Filtering rather than throwing keeps a partial save working; the `console.error` means it is never
silent. Replace the three `fieldsToPersist.map(f => inputFieldToParameterInput(...))` /
`fields.map(...)` expressions with `fieldsToParameterInputs(fields, user?.id ?? null)`.

---

## Step 3 — Rename `dbId` → `projectParameterId` (recommended)

`dbId` is ambiguous now that `InputField` carries three different ids (`id` = parameter_key,
`dbId` = row id, `activeFlagId` = flag ticket) and `Specification` carries two more (`id`,
`candidateId`). Matching the backend name kills the ambiguity at the point of use — especially in
`handleFlag`, which passes it as `parameter_id` (`hooks/ParameterManager.tsx:127`).

Only 6 references: `types/index.ts:42`, `lib/parameter-adapter.ts:123`, the new line from Step 1,
`hooks/ParameterManager.tsx:112,113,127`. Mechanical find-and-replace, do it in its own commit after
Step 1 is green.

---

## Step 4 — Verify the response shape actually matches (do this first, it's cheap)

`api/projects.ts:70-93` declares `ProjectParameter.id: string`. **Confirm the new backend still names
this field `id` in `GET /projects/{id}`, and not `project_parameter_id`.** If it was renamed, the
declared type lies, `p.id` is `undefined` at runtime, and `dbId` becomes `undefined` with no compile
error at all — the save then 422s with a confusing message. If renamed:

```ts
export interface ProjectParameter {
  project_parameter_id: string;   // was `id`
  parameter_key: string;
  ...
}
```
and update `lib/parameter-adapter.ts:123`.

Cheapest check: open a project and look at the existing `console.log('Loaded project details:', data)`
at `contexts/ProjectContext.tsx:74`, and inspect one entry of `data.parameters`.

Also worth a dev-time assert in `dbParamToInputField`:

```ts
if (!p.id) console.error('[params] ProjectParameter has no id:', p);
```

---

## Step 5 — Confirm the template pre-creates the rows

This is the load-bearing assumption of the whole design and the only part that can't be fixed on the
frontend.

The frontend can only ever send `project_parameter_id`s that came back from a GET. Projects are now
created with a `template_id` (`app/bda/page.tsx:206`, `components/Sidebar.tsx:117`,
`components/ProjectsSideBar/BDASideBar.tsx:91`). `createNewProject` already calls
`loadProjectDetails` right after creation (`contexts/ProjectContext.tsx:101`), so **if the backend
materializes the `ProjectParameter` rows from the template at project-creation time, the ids hydrate
immediately and everything works.**

If instead rows are created lazily on first save, two things break and neither is fixable in the
adapter:

- there is nothing to put in `project_parameter_id` on that first save, and
- `handlePopulateExtractedData` only merges into fields already in state, so **analysis results for a
  brand-new project would render as nothing at all**.

Test this before writing any code: create a fresh project from a template, and check that
`currentProject.parameters` is a populated array (not `[]`/`undefined`) *before* any analyze or save.
If it's empty, the backend needs to seed the rows on create (preferred) or expose an endpoint the
frontend can call to seed them.

---

## Step 6 — Known adjacent gap (not part of this fix, but next on this branch)

`components/input-fields-list.tsx:34` builds the UI from the hardcoded `SCHEMA_GROUPS` and filters
`fields` down to keys in that list. A template parameter whose key isn't one of the 27 battery keys
in `types/index.ts:52` **will be hydrated with a valid id and will be saved, but will never render**.
Same for `input-field-item.tsx:50` (default unit lookup) and `parameter-adapter.ts:17`
(`FIELD_LABEL_MAP`, which falls back to the raw key — the one place that degrades gracefully).

Fixing that means deriving the groups from the project's parameters (needs a `group`/`display_order`
/`unit` on the backend `ProjectParameter`) instead of a frontend constant. Separate task — flagging it
so it isn't mistaken for an id bug when a template parameter "disappears".

---

## Verification checklist

1. `npx tsc --noEmit` → **0 errors** (currently exactly 1, the one quoted at the top).
2. Load an existing project. The existing `console.log('Parameters to save: (1)', parameters)` at
   `api/projects.ts:142` should show a uuid `project_parameter_id` on **every** entry — no `''`, no
   `undefined`.
3. Edit a value → Save → 200 → the project reloads (`saveParameters` →`loadProjectDetails`) and the
   edited value persists after a hard refresh.
4. Flag a parameter in `/bda` → auto-save path fires with ids → refresh → flag still set.
5. Flag a parameter in `/review` (no Save button, `persistFields` only) → refresh → flag still set.
6. Fresh project from a template → parameters render → analyze → all extracted fields keep their ids
   through the SSE merge → Save → 200.
7. Approve (`handleApprove` calls `handleSave` first, `app/bda/page.tsx:143`) → 200.

## Suggested commit split

| Commit | Contents |
|---|---|
| 1 | Step 4 verification fixes (if any) + Step 1 one-liner + Step 2c guard helper & call sites |
| 2 | Step 2a/2b — `ExtractedFieldPatch`, remove placeholder `dbId: ''`, warn on dropped keys |
| 3 | Step 3 — rename `dbId` → `projectParameterId` |
