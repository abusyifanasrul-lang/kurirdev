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
  const { login: storeLogin, logout: storeLogout, updateUser: storeUpdateUser } = useSessionStore();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Find matching Firestore doc by email
        try {
          const q = query(
            collection(db, 'users'),
            where('email', '==', firebaseUser.email),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as User;
            storeLogin(userData); // Sync to Zustand
            setState({
              user: userData,
              token: null,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            console.error('User document not found in Firestore for:', firebaseUser.email);
            setState(prev => ({ ...prev, isLoading: false }));
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } else {
        // No user logged in via Firebase Auth
        storeLogout();
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
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
