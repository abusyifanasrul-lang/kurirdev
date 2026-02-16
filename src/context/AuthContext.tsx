import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthState } from '@/types';
import { authApi } from '@/services/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Check for existing auth on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      if (response.success && response.data) {
        const { user, token } = response.data;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  const updateUser = useCallback((user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
    setState((prev) => ({ ...prev, user }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
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
