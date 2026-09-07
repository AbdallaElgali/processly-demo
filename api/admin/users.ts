const API_URL = process.env.API_URL || 'http://localhost:8000';

const register_user = async (userData: { username: string; department: string; email?: string; password?: string }) => {
    try {
        const response = await fetch(`${API_URL}/auth/register-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        })
        
        if (response.ok) {
            const data = await response.json();
            console.log('User registered successfully:', data);
        }
    } catch (error) {
        console.error('Error registering user:', error);
    }
};