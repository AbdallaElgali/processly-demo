'use client';

import { useRef, useState, useCallback } from 'react';
import { InputField } from '@/types';
import { analyzeDocument, mapFieldsToSpecs } from '@/api/analyze-document'; // Import mapper

export const useAnalyze = (
  activeProjectId: string | null,
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

  // --- UPDATED: Accepts currentFields from your UI state ---
  const handleAnalyze = useCallback(async (currentFields?: InputField[]) => {
    if (!activeProjectId) return;
    if (currentFields) {
      console.log('Current fields before mapping to specs:', currentFields);
    }
    // Check if we have flagged fields. If so, map them to send as `previousSpecs`
    const hasFlaggedFields = currentFields?.some(f => f.isFlagged);
    
    const previousSpecs = hasFlaggedFields ? mapFieldsToSpecs(currentFields) : null;
    
    setIsAnalyzing(true);
    setAnalyzeStatus(previousSpecs ? 'Starting AI Correction...' : 'AI Ready...');
    
    try {
      // Pass previousSpecs as the 2nd argument
      const final = await analyzeDocument(activeProjectId, previousSpecs, (status, partial) => {
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
  }, [activeProjectId, handlePopulateExtractedData, queueAnalyzePartial]);

  return { isAnalyzing, analyzeStatus, handleAnalyze };
};