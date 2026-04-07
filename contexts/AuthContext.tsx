'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = 'http://localhost:8000/auth';

// 1. Matched the interface to the backend (changed user_id to id)
interface User {
  id: string; 
  username: string;
  department: string;
}

// 2. Fixed the user type from 'string | null' to 'User | null'
interface AuthContextType {
  user: User | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
  const validateSession = async () => {
    const storedUserData = localStorage.getItem('bda_user');
    
    if (storedUserData) {
      try {
        const parsedUser: User = JSON.parse(storedUserData);
        
        // RE-VERIFY with the backend
        const response = await fetch(`${API_URL}/user?username=${encodeURIComponent(parsedUser.username)}`);
        
        if (response.ok) {
          const freshData = await response.json();
          setUser({ 
            id: freshData.id, 
            username: freshData.username, 
            department: freshData.department 
          });
        } else {
          // If the backend says the user doesn't exist (404), clear local state
          logout();
        }
      } catch (e) {
        console.error("Session validation failed", e);
        logout();
      }
    }
    setIsLoading(false);
  };

  validateSession();
}, []);

  const login = async (username: string) => {
    try {
      const response = await fetch(`${API_URL}/user?username=${encodeURIComponent(username)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // 4. Map the backend response directly to the frontend User interface
        const currentUser: User = { 
          id: data.id, 
          username: data.username, 
          department: data.department 
        };
        
        setUser(currentUser);
        // 5. Store the stringified object so we have the ID and department on reload
        localStorage.setItem('bda_user', JSON.stringify(currentUser));
        
        return; // Interface expects Promise<void>
      } 
      
      // Handle the 404 Not Found we set up in FastAPI
      if (response.status === 404) {
        throw new Error("User does not exist. Please register first.");
      }
      
      // Catch-all for 500s or other errors
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);

    } catch (err) {
      // Re-throw so the login UI component can display the error message
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bda_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}