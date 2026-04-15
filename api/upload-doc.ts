const API_URL = process.env.API_URL || 'http://localhost:8000';

interface UploadSuccess {
  filename: string;
  document_id: string;
}

interface UploadResponse {
  project_id: string;
  successful_uploads: UploadSuccess[];
  errors: string[];
}

export const uploadDocuments = async (files: File[], project_id: string): Promise<UploadResponse> => {
  const formData = new FormData();

  formData.append('project_id', project_id);

  // The trick to sending arrays in FormData is to append the SAME key ('files') multiple times
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(API_URL + '/files/upload-documents/', {
    method: 'POST',
    body: formData,
  });

  console.log('API Response Status:', response.status);
  const data = await response.json() as UploadResponse & { message?: string };
  console.log('API Response Data:', data);

  if (response.ok) {
    return {
      project_id: data.project_id,
      successful_uploads: data.successful_uploads,
      errors: data.errors,
    };
  } else {
    throw new Error(data.message || 'Failed to upload batch of documents');
  }
};
