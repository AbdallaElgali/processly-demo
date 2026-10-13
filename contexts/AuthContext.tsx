'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useColorScheme } from '@mui/material/styles';
import { config } from '@/api/config';
import { update_user_settings, UserSettings } from '@/api/user';
import { settingsPayload, storedThemeMode } from '@/lib/auth/settings';

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
  const { setMode } = useColorScheme();
  // The latest settings, updated before a request goes out, so two changes in
  // quick succession each start from the other's result (S2).
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('bda_user');
    router.push('/login');
  }, [router]);

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
  }, [logout]);

  const updateUserSettings = async (settings: Partial<UserSettings>) => {
      const current = userRef.current;
      if (!current) throw new Error("No user logged in");
      const payload = settingsPayload(current, settings);
      const updatedUserObj: User = { ...current, template_id: payload.template_id, theme: payload.theme, lang: payload.lang };

      userRef.current = updatedUserObj;
      try {
          const updated = await update_user_settings(current.id, payload);
          if (!updated) throw new Error("Failed to update settings");

          setUser(updatedUserObj);
          localStorage.setItem('bda_user', JSON.stringify(updatedUserObj));
      } catch (err: unknown) {
          if (userRef.current === updatedUserObj) userRef.current = current;
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
        
        userRef.current = currentUser;
        setUser(currentUser);
        localStorage.setItem('bda_user', JSON.stringify(currentUser));
        // S1: the stored choice follows the person to this browser. Only at
        // login, so a local choice is not overridden on every reload.
        const storedMode = storedThemeMode(currentUser.theme);
        if (storedMode) setMode(storedMode);

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