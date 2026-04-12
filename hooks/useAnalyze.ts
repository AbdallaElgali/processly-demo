'use client';

import { useRef, useState, useCallback } from 'react';
import { InputField } from '@/types';
import { analyzeDocument } from '@/api/analyze-document';

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

  const handleAnalyze = useCallback(async () => {
    if (!activeProjectId) return;
    setIsAnalyzing(true);
    setAnalyzeStatus('AI Ready...');
    try {
      const final = await analyzeDocument(activeProjectId, (status, partial) => {
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
