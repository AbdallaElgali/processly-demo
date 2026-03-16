'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: string | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing session on mount
    const storedUser = localStorage.getItem('bda_user');
    if (storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string) => {
    // MOCK BACKEND CHECK: Replace with actual API call
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (username.trim().length > 0) {
          setUser(username);
          localStorage.setItem('bda_user', username);
          resolve();
        } else {
          reject(new Error("Username cannot be empty"));
        }
      }, 500); // simulate network delay
    });
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