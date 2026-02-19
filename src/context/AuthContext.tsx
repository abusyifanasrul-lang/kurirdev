import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthState } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';

interface AuthContextType extends AuthState {
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout: storeLogout, updateUser: storeUpdateUser } = useSessionStore();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null, // Keep for type compatibility but unused
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    setState({
      user,
      token: null,
      isAuthenticated: !!(isAuthenticated && user),
      isLoading: false,
    });
  }, [user, isAuthenticated]);

  const logout = useCallback(async () => {
    storeLogout();
  }, [storeLogout]);

  const updateUser = useCallback((updatedUser: User) => {
    storeUpdateUser(updatedUser);
  }, [storeUpdateUser]);

  return (
    <AuthContext.Provider value={{ ...state, logout, updateUser }}>
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
