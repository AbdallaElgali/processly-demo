'use client';

import { useState, useCallback } from 'react';
import { InputField } from '@/types';
import { analyzeParameter } from '@/api/analyze-parameter';
import { mapFieldsToSpecs } from '@/lib/parameter-adapter';

export const useAnalyzeParameter = (
  activeProjectId: string | null,
  user: { id: string } | null,
  handlePopulateExtractedData: (fields: InputField[]) => void,
  applyFlagChain: (chain: Record<string, string>) => void,
) => {
  // Keyed by field id so ONLY that row blocks — never hoist this into a
  // page-level flag.
  const [correctingFieldId, setCorrectingFieldId] = useState<string | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState('');
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const handleAnalyzeParameter = useCallback(async (field: InputField) => {
    if (!activeProjectId || !user) return;

    setCorrectingFieldId(field.id);
    setCorrectionStatus('Starting correction...');
    setCorrectionError(null);

    try {
      // mapFieldsToSpecs expects a list; pass just this one so the payload
      // carries only the parameter under correction.
      const scopedSpecs = mapFieldsToSpecs([field]) as Record<string, unknown>;
      const previousMetrics = (scopedSpecs?.[field.id] ?? []) as unknown[];

      const { fields, flagChain } = await analyzeParameter(
        activeProjectId,
        user,
        field.id,
        previousMetrics,
        field.flagReason ?? null,
        setCorrectionStatus,
      );

      handlePopulateExtractedData(fields);
      applyFlagChain(flagChain);
    } catch (e) {
      console.error('Parameter correction failed:', e);
      setCorrectionError(e instanceof Error ? e.message : 'Correction failed.');
    } finally {
      setCorrectingFieldId(null);
      setCorrectionStatus('');
    }
  }, [activeProjectId, user, handlePopulateExtractedData, applyFlagChain]);

  return {
    correctingFieldId,
    correctionStatus,
    correctionError,
    clearCorrectionError: () => setCorrectionError(null),
    handleAnalyzeParameter,
  };
};