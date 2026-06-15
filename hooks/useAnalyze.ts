'use client';

import { useRef, useState, useCallback } from 'react';
import { InputField } from '@/types';
import { analyzeDocument, mapFieldsToSpecs } from '@/api/analyze-document'; // Import mapper

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

  // --- UPDATED: Accepts currentFields from your UI state ---
  const handleAnalyze = useCallback(async (currentFields?: InputField[]) => {
    if (!activeProjectId || !user) return; // <-- ADDED: Ensure user exists before proceeding
    
    if (currentFields) {
      console.log('Current fields before mapping to specs:', currentFields);
    }
    // Check if we have flagged fields. If so, map them to send as `previousSpecs`
    const hasFlaggedFields = currentFields?.some(f => f.isFlagged);
    
    const previousSpecs = hasFlaggedFields ? mapFieldsToSpecs(currentFields) : null;
    
    setIsAnalyzing(true);
    setAnalyzeStatus(previousSpecs ? 'Starting AI Correction...' : 'AI Ready...');
    
    try {
      // <-- UPDATED: Pass user as the 2nd argument
      console.log('PREVIOUS SPECS: ' + previousSpecs)
      const x = 1;
      if (x == 1){
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
      handlePopulateExtractedData(final);}
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeProjectId, user, handlePopulateExtractedData, queueAnalyzePartial]); // <-- ADDED: user to dependency array

  return { isAnalyzing, analyzeStatus, handleAnalyze };
};