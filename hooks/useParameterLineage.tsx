import { useState, useEffect } from 'react';
import { fetch_parameter_lineage } from '@/api/audit/project_metrics'; // Adjust path
import type { ParameterLineageResponse } from '@/types/audit';

export function useParameterLineage(projectId: string, parameterKey: string) {
  const [lineageData, setLineageData] = useState<ParameterLineageResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLineage = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetch_parameter_lineage(projectId, parameterKey);
        console.log(data)
        
        if (isMounted) {
          // DEFENSIVE FIX: Check if data.events exists and is an array before sorting
          if (data && Array.isArray(data.events)) {
            data.events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          } else if (data) {
            // Fallback: If events is null or undefined, force it to be an empty array
            data.events = [];
          }
          
          setLineageData(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch parameter lineage');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (projectId && parameterKey) {
      loadLineage();
    }

    return () => { isMounted = false; };
  }, [projectId, parameterKey]);

  return { lineageData, isLoading, error };
}