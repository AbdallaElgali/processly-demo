import { useState, useEffect, useCallback } from 'react';
import { 
  getUserTemplates, 
  getTemplateDetails, 
  createTemplate, 
  deleteTemplate, 
  upsertTemplateRule, 
  getParameters,
  ExtractionTemplateBase,
  TemplateWithRules,
  CanonicalParameter,
  TemplateRuleUpsert
} from '@/api/templates';

import { useAuth } from '@/contexts/AuthContext';

export function useTemplateData(userId: string | undefined, authLoading: boolean) {
  const { user, updateUserSettings } = useAuth();  
  const [templates, setTemplates] = useState<ExtractionTemplateBase[]>([]);
  const [parameters, setParameters] = useState<CanonicalParameter[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<TemplateWithRules | null>(null);

  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync defaultTemplateId if the user object changes from elsewhere
  useEffect(() => {
    setDefaultTemplateId(user?.template_id || null);
  }, [user?.template_id]);

  // Initial Data Fetch
  useEffect(() => {
    if (authLoading || !userId) return;
    
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [fetchedTemplates, fetchedParams] = await Promise.all([
          getUserTemplates(userId),
          getParameters()
        ]);
        setTemplates(fetchedTemplates);
        setParameters(fetchedParams);
        setDefaultTemplateId(user?.template_id || null);
      } catch (err) {
        setError('Failed to load templates or parameters');
        throw err; 
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
  }, [userId, authLoading]);

  const updateDefaultTemplate = useCallback(async (templateId: string | null) => {
    if (!user) throw new Error("No user logged in");
    try {
      setIsSaving(true);
      await updateUserSettings({ template_id: templateId });
      // Instantly update the local UI state
      setDefaultTemplateId(templateId); 
    } finally {
      setIsSaving(false);
    }
  }, [user, updateUserSettings]);

  // Select a Template
  const selectTemplate = useCallback(async (templateId: string) => {
    try {
      setIsLoading(true);
      const details = await getTemplateDetails(templateId);
      setActiveTemplate(details);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a Template
  const createNewTemplate = useCallback(async (name: string) => {
    if (!userId) throw new Error('User not found');
    try {
      setIsSaving(true);
      const newTemplate = await createTemplate({
        name,
        user_id: userId,
        is_global: false
      });
      setTemplates(prev => [...prev, newTemplate]);
      await selectTemplate(newTemplate.id);
      return newTemplate;
    } finally {
      setIsSaving(false);
    }
  }, [userId, selectTemplate]);

  // Delete a Template
  const removeTemplate = useCallback(async (templateId: string) => {
    try {
      await deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setActiveTemplate(prev => prev?.id === templateId ? null : prev);
    } catch (err) {
      throw err;
    }
  }, []);

  // Upsert a Rule
  const saveRule = useCallback(async (ruleData: TemplateRuleUpsert) => {
    if (!activeTemplate) throw new Error('No active template');
    try {
      setIsSaving(true);
      await upsertTemplateRule(activeTemplate.id, ruleData);
      // Refresh active template to get updated rules
      await selectTemplate(activeTemplate.id);
    } finally {
      setIsSaving(false);
    }
  }, [activeTemplate, selectTemplate]);

  return {
    templates,
    parameters,
    activeTemplate,
    isLoading,
    isSaving,
    error,
    defaultTemplateId,
    selectTemplate,
    createNewTemplate,
    removeTemplate,
    saveRule,
    updateDefaultTemplate
  };
}