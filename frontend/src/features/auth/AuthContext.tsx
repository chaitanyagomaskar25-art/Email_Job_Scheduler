import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { User } from '../../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  googleConfigured: boolean;
  loginWithGoogle: () => void;
  mockLogin: (email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  const fetchCurrentUser = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/auth/me');
      setUser(res.data.data.user);
      setGoogleConfigured(res.data.data.googleConfigured ?? false);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const loginWithGoogle = () => {
    window.location.href = '/api/auth/google';
  };

  const mockLogin = async (email = 'demo@reachinbox.test', name = 'ReachInbox Demo User') => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/mock-login', { email, name });
      setUser(res.data.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        googleConfigured,
        loginWithGoogle,
        mockLogin,
        logout,
        refetchUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

