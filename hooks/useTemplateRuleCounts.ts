'use client';

import { useEffect, useState } from 'react';
import { getTemplateDetails, type ExtractionTemplateBase } from '@/api/templates';

// The template list has no rule count, so each template's detail is read once and
// the count kept for the session. Every rule change calls `invalidateRuleCount`.
const counts = new Map<string, number>();
const listeners = new Set<() => void>();

export function setRuleCount(templateId: string, count: number) {
  counts.set(templateId, count);
  listeners.forEach((l) => l());
}

export function invalidateRuleCount(templateId: string) {
  counts.delete(templateId);
  listeners.forEach((l) => l());
}

/** `{ templateId: rules }` for the templates whose count is known; the rest load in the background. */
export function useTemplateRuleCounts(templates: ExtractionTemplateBase[] | null): Record<string, number> {
  const [, bump] = useState(0);

  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const ids = (templates ?? []).map((t) => t.id).join(',');
  const missingKey = (templates ?? []).filter((t) => !counts.has(t.id)).map((t) => t.id).join(',');

  useEffect(() => {
    let cancelled = false;
    for (const id of missingKey ? missingKey.split(',') : []) {
      getTemplateDetails(id)
        .then((d) => {
          if (!cancelled) setRuleCount(id, d.rules.length);
        })
        .catch(() => {
          /* the count stays blank; the template still works */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [ids, missingKey]);

  return Object.fromEntries(counts);
}
