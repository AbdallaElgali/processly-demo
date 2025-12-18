

const API_URL = process.env.API_URL || 'http://localhost:8000';

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