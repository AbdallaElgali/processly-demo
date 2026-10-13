# U2: honest "interrupted upload" message

- **Started:** 2026-10-14. **Branch:** fe/u2-interrupted-upload (from main). No extraction runs, no backend edits, server on :8000 untouched, ../BDA read only.
- Facts from BDA step U1 (`../BDA/claude-notes/history/*_u1-upload-failures.md`, section 4 and "Error texts"): a fully sent upload keeps running on the server after the tab closes and is saved; a document is listed only when fully processed; `documents.name` is the uploaded file name (`upload_files.py` passes `file.filename`); error bodies are `{detail, message}`.

## Goal
1. Interrupted upload after reload: check the project's documents against the job's file names instead of claiming "nothing was saved".
2. "Run again" re-sends only the files that are missing.
3. Upload errors show the backend's text.
4. Tab warning also for uploads, with its own text.

## Plan
Tests first: `lib/jobs/uploadRecovery.test.ts` (pure matching, polling, texts), `api/upload-error.test.ts`, reducer + closeGuard tests. Then implementation.

## Changes
- `lib/jobs/uploadRecovery.ts` (new, + test): `splitByDocuments` (saved vs missing by file name), `checkUploadOutcome` (immediate check, then polling: 6 checks, 12 s apart, about 60 s; a failed read is an attempt, never "missing"), `interruptedUploadText`, `resendNotice`, the texts.
- `lib/jobs/types.ts`, `reducer.ts` (+ tests): `Job.uploadCheck`, `Job.savedWhileAway`, action `uploadCheck`, `complete` takes `savedWhileAway`.
- `lib/jobs/runtime.ts`: `recoverUpload` (started for uploads that become interrupted, and at start-up for an interrupted upload whose check never finished), `runUploadAgain` (re-sends only missing files, toast says how many; reads the project first and sends nothing if it cannot), `finishSavedWhileAway`.
- `components/jobs/JobBanner.tsx`, `components/workspace/JobStatusLine.tsx`: upload texts from the check; extraction/correction texts unchanged; a recovered upload reads "Saved while you were away".
- `api/upload-error.ts` (new, + test), `api/upload-doc.ts`: error text = `detail`, else `message`, else `error`, else validation `msg`, else plain-text body, else "Upload failed (HTTP n)." (no more "Failed to upload batch of documents").
- `lib/jobs/closeGuard.ts` (+ test), `JobTray.tsx`, `JobStatusLine.tsx`, `JobBanner.tsx`: `hasRunningUpload`, `keepOpenText` (analysis wins when both run); upload text "Keep this tab open until the upload has been sent"; `beforeunload` now also fires for a running upload.
- `CLAUDE.md` §6: upload behaviour added (rule 7).

## Decisions
- Matching is by file name against `documents.name` (the backend stores `file.filename`). Two files with the same name in one job count as one.
- A project that cannot be read is "unknown" (own text), never "Not saved". For Run again an unreadable project sends nothing.
- A recovered job is completed with `seen: false` so the "Saved while you were away" line is shown even on the open project; pending file blobs are deleted then.
- Partly saved: stays Interrupted, text "N files saved while you were away; M not saved. Upload again", banner lists the missing names.
- The check is tab-local polling; two tabs may both poll (harmless, idempotent).

## Gaps found
- `beforeunload` cannot tell "still sending" from "sent, server processing": the warning stays for the whole running upload.
- A same-named file already in the project from an earlier upload would count as "saved" (name-only match; the upload route has no per-job id).

## Verification
- `npx tsc --noEmit`, `npm run lint`: clean. `npm test`: 30 files, 394 tests pass. `npm run check:contrast`: 90/90. `npm run build`: passes.
- Tests written first for the matching, polling, texts, error parsing, reducer and close guard. Not exercised in a browser (no extraction runs; see checklist).

## Browser checklist (for you)
1. Upload a small file, and while the Workspace shows "Upload: Uploading" the banner/tray says "Keep this tab open until the upload has been sent"; closing the tab shows the browser prompt.
2. Upload a file, reload the tab right after the send. Expect "Checking whether the server finished…", then "Saved while you were away" and the document in the tabs.
3. Stop the backend's work is not possible; to see "Not saved": queue an upload, reload while it is still *sending* (large file). Expect "Not saved. Upload again" after about a minute, with Run again / Dismiss.
4. Run again on a partly saved job: toast "Re-sending N file(s) that are not in the project; M already saved", only those go.
5. Run again when everything is already in the project: toast "All files are already in the project; nothing to re-send."
6. Force an upload error (e.g. a project whose grouping fails): the failure shows "…grouping failed: TimeoutError: …", not "Failed to upload batch of documents".
7. Extraction running + reload: still "interrupted; nothing was saved" and "Keep this tab open until the analysis finishes".
8. Console has no errors or warnings on Workspace in light and dark mode.

## Next
Browser pass by the owner (checklist above).
