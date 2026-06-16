'use client';

import { useRef, useState, useCallback } from 'react';
import { InputField } from '@/types';
import { analyzeDocument } from '@/api/analyze-document';
import { mapFieldsToSpecs } from '@/lib/parameter-adapter';

export const useAnalyze = (
  activeProjectId: string | null,
  user: { id: string } | null, // <-- ADDED: Accept user object
  handlePopulateExtractedData: (fields: InputField[]) => void
) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const analyzeUiTickRef = useRef<number | null>(null);
  const pendingPartialRef = useRef<InputField[] | null>(null);

  const flushAnalyzePartial = useCallback(() => {
    analyzeUiTickRef.current = null;
    if (!pendingPartialRef.current) return;
    handlePopulateExtractedData(pendingPartialRef.current);
    pendingPartialRef.current = null;
  }, [handlePopulateExtractedData]);

  const queueAnalyzePartial = useCallback((partial: InputField[]) => {
    pendingPartialRef.current = partial;
    if (analyzeUiTickRef.current !== null) return;
    analyzeUiTickRef.current = window.setTimeout(flushAnalyzePartial, 120);
  }, [flushAnalyzePartial]);

  // Accepts the current UI fields so flagged ones can be sent as `previousSpecs`
  // for iterative correction.
  const handleAnalyze = useCallback(async (currentFields?: InputField[]) => {
    if (!activeProjectId || !user) return;

    const hasFlaggedFields = currentFields?.some(f => f.isFlagged);
    const previousSpecs = hasFlaggedFields ? mapFieldsToSpecs(currentFields) : null;

    setIsAnalyzing(true);
    setAnalyzeStatus(previousSpecs ? 'Starting AI Correction...' : 'AI Ready...');

    try {
      const final = await analyzeDocument(activeProjectId, user, previousSpecs, (status, partial) => {
        setAnalyzeStatus(status);
        queueAnalyzePartial(partial);
      });

      if (analyzeUiTickRef.current !== null) {
        clearTimeout(analyzeUiTickRef.current);
        analyzeUiTickRef.current = null;
      }
      if (pendingPartialRef.current) {
        handlePopulateExtractedData(pendingPartialRef.current);
        pendingPartialRef.current = null;
      }
      handlePopulateExtractedData(final);
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeProjectId, user, handlePopulateExtractedData, queueAnalyzePartial]);

  return { isAnalyzing, analyzeStatus, handleAnalyze };
};