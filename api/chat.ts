import { config } from './config';

const API_URL = config.api;

export const sendMessage = async(message: string, fileId: string) => {
  const response = await fetch(API_URL +'/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: fileId, 
      message: message
    })});

  if (!response.ok) {
    throw new Error('Chat message failed');
  }
    const data = await response.json();
    return data.response;
}