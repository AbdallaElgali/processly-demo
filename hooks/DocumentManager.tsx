import { useState, useCallback } from 'react';
import { uploadDocuments } from '@/api/upload-doc';
import { ActiveHighlight } from '@/types';
import { ProjectDocument } from '@/api/projects';

interface UploadedFile {
  id: string;
  name: string;
  fileBlob: File;
  fileType: string;
  fileUrl: string;
}

export const useDocumentManager = (projectId: string | null) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<ActiveHighlight>(null);

  const activeDoc = uploadedFiles.find(f => f.id === activeFileId) || null;

  // CRITICAL: Functional update prevents User 1 -> User 2 data leaks
  const clearFiles = useCallback(() => {
    setUploadedFiles((prev) => {
      prev.forEach(file => {
        if (file.fileUrl.startsWith('blob:')) URL.revokeObjectURL(file.fileUrl);
      });
      return [];
    });
    setActiveFileId(null);
    setActiveSource(null);
  }, []);

  const hydrateFiles = useCallback(async (dbDocs: ProjectDocument[]) => {
    const API_BASE = process.env.API_URL || 'http://localhost:8000';
    setIsLoading(true);
    try {
      // Revoke any existing blob URLs before replacing
      setUploadedFiles(prev => {
        prev.forEach(file => {
          if (file.fileUrl.startsWith('blob:')) URL.revokeObjectURL(file.fileUrl);
        });
        return prev;
      });

      const hydrated = await Promise.all(dbDocs.map(async (doc) => {
        const relativePath = doc.file_url;
        if (!relativePath) return null;

        // Cache-busting prevents the browser from showing the previous user's file
        const response = await fetch(`${API_BASE}${relativePath}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`Fetch failed for ${doc.name}`);
        const blob = await response.blob();

        const mimeType = doc.type === 'pdf'
          ? 'application/pdf'
          : doc.type === 'excel' || doc.type === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : blob.type || 'application/octet-stream';

        return {
          id: doc.id,
          name: doc.name,
          fileType: mimeType,
          fileUrl: URL.createObjectURL(blob),
          fileBlob: new File([blob], doc.name),
        };
      }));

      const validFiles = hydrated.filter((f): f is UploadedFile => f !== null);
      setUploadedFiles(validFiles);
      if (validFiles.length > 0) setActiveFileId(validFiles[0].id);
    } catch (e) {
      console.error("Hydration Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDocumentUpload = useCallback(async (files: File[]) => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await uploadDocuments(files, projectId);
      if (response && response.successful_uploads) {
        const newFiles: UploadedFile[] = response.successful_uploads.map((successItem: { filename: string; document_id: string }) => {
          const originalFile = files.find(f => f.name === successItem.filename)!;
          return {
            id: successItem.document_id,
            name: originalFile.name,
            fileType: originalFile.type || (originalFile.name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
            fileUrl: URL.createObjectURL(originalFile),
            fileBlob: originalFile,
          };
        });
        setUploadedFiles(prev => [...prev, ...newFiles]);
        if (newFiles.length > 0) setActiveFileId(newFiles[0].id);
      }
    } catch (error) {
      console.error('Upload Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const handleSelectFile = (id: string) => {
    setActiveFileId(id);
    setActiveSource(null);
  };

  const handleJumpToSource = useCallback((source: ActiveHighlight) => {
    console.log(source)
    if (!source) return;
    // Only switch the active file when we have an explicit documentId.
    // If documentId is null (e.g. DB-hydrated params), keep the current
    // file visible and just update the highlight on whatever is shown.
    if (source.documentId) {
      setActiveFileId(source.documentId);
    }
    setActiveSource(source);
  }, []);

  return {
    uploadedFiles, activeFileId, activeDoc, activeSource,
    isLoading, handleDocumentUpload, handleSelectFile, handleJumpToSource, hydrateFiles, clearFiles
  };
};
