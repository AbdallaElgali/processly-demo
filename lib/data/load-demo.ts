export const loadDemoFile = async (filePath: string, fileName: string): Promise<File> => {
  // 1. Fetch the file from the public folder
  const response = await fetch(filePath);
  const blob = await response.blob();
  
  // 2. Create a proper File object (simulating a user upload)
  return new File([blob], fileName, { type: 'application/pdf' });
};