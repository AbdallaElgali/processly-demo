import type { ProjectCreateInput } from '@/api/projects';

export interface NewProjectDraft {
  alias: string;
  customerId: string;
  userId: string | null | undefined;
  templateId: string;
  description: string;
}

/** Create is enabled only with a name, a customer (mandatory since backend 3.13) and a signed-in user. */
export function canCreateProject(d: Pick<NewProjectDraft, 'alias' | 'customerId' | 'userId'>): boolean {
  return d.alias.trim() !== '' && d.customerId !== '' && !!d.userId;
}

/** The create body; `customer_id` is always a string, never null. */
export function buildCreateInput(d: NewProjectDraft): ProjectCreateInput {
  if (!d.customerId) throw new Error('Choose a customer first.');
  if (!d.userId) throw new Error('You need to be signed in to create a project.');
  return {
    alias_id: d.alias.trim(),
    description: d.description.trim(),
    customer_id: d.customerId,
    user_id: d.userId,
    template_id: d.templateId || null,
  };
}
