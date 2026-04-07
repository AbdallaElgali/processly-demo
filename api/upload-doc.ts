const API_URL = process.env.API_URL || 'http://localhost:8000';

// 1. Updated to accept an array of File objects
export const uploadDocuments = async(files: File[], project_id: string): Promise<any> => {
  const formData = new FormData();
  
  formData.append('project_id', project_id);

  // 2. The trick to sending arrays in FormData is to append the SAME key ('files') multiple times
  files.forEach((file) => {
    formData.append('files', file);
  });

  // 3. Updated the URL to the plural endpoint
  const response = await fetch(API_URL + '/files/upload-documents/', {
    method: 'POST',
    body: formData,
  });

  console.log('API Response Status:', response.status);
  const data = await response.json();
  console.log('API Response Data:', data);

  if (response.ok) {
    // 4. Return the new payload structure so your UI can display successes and failures
    return {
      project_id: data.project_id,
      successful_uploads: data.successful_uploads, // Array containing {filename, document_id, etc.}
      errors: data.errors // Array containing any files that failed to analyze
    };
  } else {
    throw new Error(data.message || 'Failed to upload batch of documents');
  }
};