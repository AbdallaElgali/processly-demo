'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTemplate,
  createTemplateFromProject,
  deleteTemplate,
  getTemplateDetails,
  getUserTemplates,
  upsertTemplateRule,
  type ExtractionTemplateBase,
  type TemplateRuleUpsert,
  type TemplateWithRules,
} from '@/api/templates';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/errors';

/**
 * The signed-in user's extraction templates and the one that is open.
 *
 * The logic of the old `useTemplateData` / `TemplatesManager` (list, open,
 * create, delete, upsert a rule, set the default), without its problems: a
 * failed first load was rethrown inside an effect (an unhandled rejection
 * and a permanent skeleton), opening two templates quickly let the slower
 * response win, and the canonical dictionary was fetched here a second time
 * (it is `useCanonicalParameters`' job now).
 *
 * Every mutation throws a readable `Error` for the caller's dialog or toast.
 */
export function useTemplates() {
  const { user, updateUserSettings } = useAuth();
  const userId = user?.id;

  const [templates, setTemplates] = useState<ExtractionTemplateBase[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [open, setOpen] = useState<TemplateWithRules | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const openRequest = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getUserTemplates(userId)
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch((e) => {
        if (!cancelled) setListError(errorMessage(e, 'Failed to load templates.'));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const retry = useCallback(() => {
    setListError(null);
    setTemplates(null);
    setAttempt((n) => n + 1);
  }, []);

  /** Opens a template's detail. Only the latest request may set the result. */
  const openTemplate = useCallback(async (templateId: string) => {
    const request = ++openRequest.current;
    setOpenId(templateId);
    setOpen((prev) => (prev?.id === templateId ? prev : null));
    setOpenError(null);
    try {
      const details = await getTemplateDetails(templateId);
      if (request === openRequest.current) setOpen(details);
    } catch (e) {
      if (request === openRequest.current) setOpenError(errorMessage(e, 'Failed to load the template.'));
    }
  }, []);

  const closeTemplate = useCallback(() => {
    openRequest.current += 1;
    setOpenId(null);
    setOpen(null);
    setOpenError(null);
  }, []);

  const create = useCallback(
    async (name: string) => {
      if (!userId) throw new Error('Sign in to create a template.');
      const made = await createTemplate({ name: name.trim(), user_id: userId, is_global: false });
      setTemplates((prev) => [made, ...(prev ?? [])]);
      return made;
    },
    [userId],
  );

  /** `POST /extraction-templates/from-project`: copies the project's parameters into a new personal template. */
  const saveProjectAsTemplate = useCallback(
    async (projectId: string, name: string) => {
      if (!userId) throw new Error('Sign in to create a template.');
      const made = await createTemplateFromProject({ project_id: projectId, user_id: userId, new_template_name: name.trim() });
      setTemplates((prev) => [made, ...(prev ?? [])]);
      return made;
    },
    [userId],
  );

  const remove = useCallback(
    async (templateId: string) => {
      await deleteTemplate(templateId);
      setTemplates((prev) => (prev ?? []).filter((t) => t.id !== templateId));
      if (openId === templateId) closeTemplate();
    },
    [openId, closeTemplate],
  );

  /** Upserts one rule of the open template, then reloads it so the list shows what the server stored. */
  const saveRule = useCallback(
    async (data: TemplateRuleUpsert) => {
      if (!open) throw new Error('No template is open.');
      await upsertTemplateRule(open.id, data);
      const fresh = await getTemplateDetails(open.id);
      setOpen((prev) => (prev?.id === fresh.id ? fresh : prev));
    },
    [open],
  );

  /** The user's default template for new projects (`user_settings.template_id`). */
  const setDefault = useCallback(
    async (templateId: string | null) => {
      await updateUserSettings({ template_id: templateId });
    },
    [updateUserSettings],
  );

  return {
    userId,
    templates,
    loading: templates === null && !listError,
    listError,
    retry,
    open,
    openId,
    openError,
    openTemplate,
    closeTemplate,
    create,
    saveProjectAsTemplate,
    remove,
    saveRule,
    setDefault,
    defaultTemplateId: user?.template_id ?? null,
  };
}
