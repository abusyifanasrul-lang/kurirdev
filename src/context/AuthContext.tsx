import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User, AuthState } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface AuthContextType extends AuthState {
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use specific selectors to avoid subscribing to the whole store (prevents render loops)
  const user = useSessionStore(state => state.user);
  const isAuthenticated = useSessionStore(state => state.isAuthenticated);
  const storeLogin = useSessionStore(state => state.login);
  const storeLogout = useSessionStore(state => state.logout);
  const storeUpdateUser = useSessionStore(state => state.updateUser);
  
  // Local state for initial boot
  const [isInitializing, setIsInitializing] = useState(() => {
    try {
      const storage = localStorage.getItem('session-storage');
      if (storage) {
        const { state } = JSON.parse(storage);
        return !(state?.isAuthenticated && state?.user);
      }
    } catch (e) {}
    return true;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const q = query(
            collection(db, 'users'),
            where('email', '==', firebaseUser.email),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            storeLogin(querySnapshot.docs[0].data() as User);
          }
        } catch (error) {
          console.error('Auth sync error:', error);
        } finally {
          setIsInitializing(false);
        }
      } else {
        storeLogout();
        setIsInitializing(false);
      }
    });
    return () => unsubscribe();
  }, [storeLogin, storeLogout]);

  const logout = useCallback(async () => {
    await signOut(auth);
    storeLogout();
  }, [storeLogout]);

  const updateUser = useCallback((updatedUser: User) => {
    storeUpdateUser(updatedUser);
  }, [storeUpdateUser]);

  // Memoize value to prevent downstream re-render cascades
  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading: isInitializing || (isAuthenticated && !user),
    token: null,
    logout,
    updateUser,
  }), [user, isAuthenticated, isInitializing, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
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
