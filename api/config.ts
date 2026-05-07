
export const config = {
    api: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    timeout: 30000, // 30 seconds
    retry: 3, // Number of retry attempts for failed requests
}