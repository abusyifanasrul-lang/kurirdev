import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const { user, isAuthenticated, login: storeLogin, logout: storeLogout, updateUser: storeUpdateUser } = useSessionStore();
  
  // Local state only for the very first initialization/cold boot
  const [isInitializing, setIsInitializing] = useState(() => {
    try {
      const storage = localStorage.getItem('session-storage');
      if (storage) {
        const { state: persistedState } = JSON.parse(storage);
        return !(persistedState?.isAuthenticated && persistedState?.user);
      }
    } catch (e) {}
    return true; // No session found? Start with a loading screen
  });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Only fetch from Firestore if we don't have a user in store, or if it might be stale
        try {
          const q = query(
            collection(db, 'users'),
            where('email', '==', firebaseUser.email),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as User;
            storeLogin(userData); // Sync to Zustand (Single Source of Truth)
          }
        } catch (error) {
          console.error('Error fetching user data on auth change:', error);
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

  const value = {
    user,
    isAuthenticated,
    isLoading: isInitializing,
    token: null,
    logout,
    updateUser,
  };

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
