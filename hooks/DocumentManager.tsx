import { useState, useCallback } from 'react';
import { uploadDocuments } from '@/api/upload-doc'; 
import { PDFSource, ExcelSource } from '@/types';

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
  const [activeSource, setActiveSource] = useState<PDFSource | ExcelSource | null>(null);

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

  const hydrateFiles = useCallback(async (dbDocs: any[]) => {
    const API_BASE = 'http://localhost:8000';
    setIsLoading(true);
    try {
      const hydrated = await Promise.all(dbDocs.map(async (doc) => {
        const relativePath = doc.file_url; 
        if (!relativePath) return null;

        // Cache-busting prevents the browser from showing the previous user's file
        const response = await fetch(`${API_BASE}${relativePath}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`Fetch failed for ${doc.name}`);
        const blob = await response.blob();
        
        return {
          id: doc.id,
          name: doc.name,
          fileType: doc.type === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel',
          fileUrl: URL.createObjectURL(blob),
          fileBlob: new File([blob], doc.name),
        };
      }));

      setUploadedFiles(hydrated.filter(f => f !== null) as UploadedFile[]);
      if (hydrated.length > 0) setActiveFileId(hydrated[0]?.id || null);
    } catch (e) {
      console.error("Hydration Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDocumentUpload = async (files: File[]) => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await uploadDocuments(files, projectId);
      if (response && response.successful_uploads) {
        const newFiles: UploadedFile[] = response.successful_uploads.map((successItem: any) => {
          const originalFile = files.find(f => f.name === successItem.filename)!;
          return {
            id: successItem.document_id,
            name: originalFile.name,
            fileType: originalFile.type || (originalFile.name.endsWith('pdf') ? 'application/pdf' : 'application/vnd.ms-excel'),
            fileUrl: URL.createObjectURL(originalFile), 
            fileBlob: originalFile,
          };
        });
        setUploadedFiles(prev => [...prev, ...newFiles]);
        setActiveFileId(newFiles[0].id);
      }
    } catch (error) {
      console.error('Upload Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = (id: string) => {
    setActiveFileId(id);
    setActiveSource(null); 
  };

  const handleJumpToSource = useCallback((source: any) => {
    setActiveFileId(source.documentId);
    setActiveSource(source);
    console.log('Active Source: ', source)
  }, []);

  return { 
    uploadedFiles, activeFileId, activeDoc, activeSource, 
    isLoading, handleDocumentUpload, handleSelectFile, handleJumpToSource, hydrateFiles, clearFiles 
  };
};