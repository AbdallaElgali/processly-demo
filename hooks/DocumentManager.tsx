import { useState, useCallback } from 'react';
import { uploadDocument } from '@/api/upload-doc';
import { PDFSource, ExcelSource } from '@/types';

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
  const [activeSource, setActiveSource] = useState<PDFSource | ExcelSource | null>(null);

  const activeDoc = uploadedFiles.find(f => f.id === activeFileId) || null;

  const handleDocumentUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const response = await uploadDocument(file, projectId);
      
      if (response && response.project_id && response.document_id) {
        let safeFileType = file.type;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!safeFileType) {
          safeFileType = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        const newFile: UploadedFile = {
          id: response.document_id,
          name: file.name,
          fileType: safeFileType,
          fileUrl: URL.createObjectURL(file),
          fileBlob: file,
        };
        
        setUploadedFiles(prev => [...prev, newFile]);
        setActiveFileId(response.document_id);
        setActiveSource(null); 
      }
    } catch (error) {
      console.error('[Upload] Error uploading document:', error);
      alert('Failed to upload document.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = (id: string) => {
    setActiveFileId(id);
    setActiveSource(null); 
  };

  const resolveSource = useCallback((source: any) => {
    let fileId = source.documentId;
    const file = uploadedFiles.find(f => f.id === fileId);
    
    if (!file) return source; 

    const type = file.fileType.toLowerCase();

    // Route: PDF
    if (type.includes('pdf')) {
      let bbox = source.boundingBox;
      if (bbox && !Array.isArray(bbox) && 'x0' in bbox) {
        bbox = [bbox.x0, bbox.y0, bbox.x1, bbox.y1];
      }
      return {
        fileId,
        pageNumber: source.pageNumber,
        boundingBox: bbox,
        textSnippet: source.textSnippet,
        documentId: source.documentId
      };
    } 
    
    // Route: Excel
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv') || type.includes('sheet')) {
      let mappedCoords = source.cellCoordinates;

      // Ensure fallback translation if backend sends grid as BoundingBox
      if (!mappedCoords && source.boundingBox) {
        let x0, y0;
        if (Array.isArray(source.boundingBox)) {
          x0 = source.boundingBox[0]; y0 = source.boundingBox[1];
        } else {
          x0 = source.boundingBox.x0; y0 = source.boundingBox.y0;
        }
        if (x0 !== undefined && y0 !== undefined) {
          mappedCoords = { row: Math.floor(y0) + 1, column: Math.floor(x0) + 1 };
        }
      }

      return {
        fileId,
        pageNumber: source.pageNumber,
        tableName: source.tableName,
        cellCoordinates: mappedCoords,
        boundingBox: source.boundingBox, // CRITICAL FIX: Retain Bounding Box for Excel block highlighting
        textSnippet: source.textSnippet || (mappedCoords ? `Cell: (${mappedCoords.row}, ${mappedCoords.column})` : 'N/A'),
        documentId: source.documentId
      };
    } 
    
    return source; 
  }, [uploadedFiles]);

  const handleJumpToSource = useCallback((source: any) => {
    if (!source || !source.documentId) return; 

    const targetFile = uploadedFiles.find(f => f.id === source.documentId);
    if (!targetFile) {
      alert(`Cannot find the source document for this metric. (ID: ${source.documentId})`);
      return;
    }

    setActiveFileId(source.documentId); 
    setActiveSource(resolveSource(source));
  }, [uploadedFiles, resolveSource]);

  return { 
    uploadedFiles, activeFileId, activeDoc, activeSource, 
    isLoading, handleDocumentUpload, handleSelectFile, handleJumpToSource 
  };
};