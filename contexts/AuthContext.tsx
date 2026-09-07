'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { config } from '@/api/config';
import { update_user_settings, UserSettings } from '@/api/user';

const API_URL = config.api;

const AUTH_API_URL = API_URL + '/auth';

interface User {
  id: string; 
  username: string;
  department: string;
  template_id: string | null; // Fixed: Now allows null
  lang: string | null;
  settings_last_updated_at: string;
  theme: string | null; // Fixed: Now allows null
}

interface AuthContextType {
  user: User | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
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
          const response = await fetch(`${AUTH_API_URL}/user?username=${encodeURIComponent(parsedUser.username)}`);
          
          if (response.ok) {
            const freshData = await response.json();
            setUser({ 
              id: freshData.id, 
              username: freshData.username, 
              department: freshData.department,
              template_id: freshData.template_id,
              theme: freshData.theme,
              settings_last_updated_at: freshData.settings_last_updated_at,
              lang: freshData.lang
            });

          } else {
            // If the backend says the user doesn't exist (404), clear local state
            logout();
          }
        } catch (e: unknown) {
          console.error("Session validation failed", e);
          logout();
        }
      }
      setIsLoading(false);
    };

    validateSession();
  }, []);

  const updateUserSettings = async (settings: Partial<UserSettings>) => {
      if (!user) throw new Error("No user logged in");
      const updatedSettings = { user_id: user.id, ...user, ...settings };
      
      try {
          const updated = await update_user_settings(user.id, updatedSettings);
          if (!updated) throw new Error("Failed to update settings");

          // CREATE the new object first
          const updatedUserObj: User = {
            ...user, 
            template_id: settings.template_id !== undefined ? settings.template_id : user.template_id, 
            theme: settings.theme !== undefined ? settings.theme : user.theme, 
            lang: settings.lang !== undefined ? settings.lang : user.lang
          };

          // SET the new object to BOTH state and local storage simultaneously 
          setUser(updatedUserObj);
          localStorage.setItem('bda_user', JSON.stringify(updatedUserObj));
          
      } catch (err: unknown) {
          throw new Error(err instanceof Error ? err.message : String(err));
      }
    }

  const login = async (username: string) => {
    try {
      const response = await fetch(`${AUTH_API_URL}/user?username=${encodeURIComponent(username)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        const currentUser: User = { 
          id: data.id, 
          username: data.username, 
          department: data.department,
          lang: data.lang,
          template_id: data.template_id,
          theme: data.theme,
          settings_last_updated_at: data.settings_last_updated_at
        };
        
        setUser(currentUser);
        localStorage.setItem('bda_user', JSON.stringify(currentUser));
        
        return; 
      } 
      
      if (response.status === 404) {
        throw new Error("User does not exist. Please register first.");
      }
      
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);

    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bda_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, updateUserSettings }}>
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