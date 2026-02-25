import { useState, useCallback } from 'react';
import { uploadDocument } from '@/api/upload-doc';
import { v4 as uuidv4 } from 'uuid';

interface UploadedFile {
  id: string;
  name: string;
  fileBlob: File; 
  fileType: string;
  fileUrl: string;
}

export const useDocumentManager = (projectId: string) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<{file: string, pageNumber: number, boundingBox: [number, number, number, number], textSnippet: string} | null>(null);

  const activeDoc = uploadedFiles.find(f => f.id === activeFileId) || null;

  const handleDocumentUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const success = await uploadDocument(file, projectId);
      if (success) {
        const newFileId = uuidv4();
        const newFile: UploadedFile = {
          id: newFileId,
          name: file.name,
          fileType: file.type,
          fileUrl: URL.createObjectURL(file),
          fileBlob: file,
        };
        
        setUploadedFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        setActiveSource(null); 
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = (id: string) => {
    setActiveFileId(id);
    setActiveSource(null); // Clear highlight when manually switching tabs
  };

  // When clicking a source link on a parameter, switch to the correct file AND set the highlight
  const handleJumpToSource = useCallback((source: any) => {
    if (source && source.file) {
      setActiveFileId(source.file); // Switch the PDF viewer to the correct file
      setActiveSource(source);      // Draw the box
    }
  }, []);

  return { 
    uploadedFiles, 
    activeFileId, 
    activeDoc, 
    activeSource, 
    isLoading, 
    handleDocumentUpload, 
    handleSelectFile, 
    handleJumpToSource 
  };
};