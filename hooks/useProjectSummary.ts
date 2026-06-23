import { useState, useEffect } from 'react';
import { fetch_project_summary } from '@/api/audit/project_metrics'; // Adjust path
import type { ProjectSummary } from '@/types/audit';

export function useProjectSummary(projectId: string) {
  const [summaryData, setSummaryData] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetch_project_summary(projectId);
        if (isMounted) {
          setSummaryData(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch project summary');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (projectId) {
      loadSummary();
    }

    return () => {
      isMounted = false; // Cleanup to prevent state updates if component unmounts
    };
  }, [projectId]);

  return { summaryData, isLoading, error };
}