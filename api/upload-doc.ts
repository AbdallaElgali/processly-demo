import {InputField } from "@/types";

const API_URL = process.env.API_URL || 'http://localhost:8000';



export const uploadDocument = async(file: File, project_id: string): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', project_id);

  const response = await fetch(API_URL + '/files/upload-document/', {
    method: 'POST',
    body: formData,
  });

  console.log('API Response Status:', response.status);
  const data = await response.json();
  console.log('API Response Data:', data);

  console.log('API Response status code: ', response.status);
  if (response.ok){
    return true;
  } else {
    throw new Error(data.message || 'Failed to upload document');
  }
};

