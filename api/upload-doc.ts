import { config } from './config';
import { uploadErrorText } from './upload-error';

const API_URL = config.api;

export interface UploadSuccess {
  filename: string;
  document_id: string;
}

/**
 * Per-file failure. The backend appends objects, not strings
 * (BDA/src/api_routes/upload_files.py:70,105) -- this type previously said
 * `string[]`, so a partial failure rendered as "[object Object]" if it was
 * shown at all. Nothing surfaced them before.
 */
export interface UploadFailure {
  filename: string;
  error: string;
}

export interface UploadResponse {
  project_id: string;
  successful_uploads: UploadSuccess[];
  errors: UploadFailure[];
}

export const uploadDocuments = async (
  files: File[],
  project_id: string,
  signal?: AbortSignal,
): Promise<UploadResponse> => {
  const formData = new FormData();

  formData.append('project_id', project_id);

  // The trick to sending arrays in FormData is to append the SAME key ('files') multiple times
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(API_URL + '/files/upload-documents/', {
    method: 'POST',
    body: formData,
    signal,
  });

  const body = await response.text();
  if (!response.ok) throw new Error(uploadErrorText(response.status, body));

  const data = JSON.parse(body) as UploadResponse;
  return {
    project_id: data.project_id,
    successful_uploads: data.successful_uploads,
    errors: data.errors,
  };
};
