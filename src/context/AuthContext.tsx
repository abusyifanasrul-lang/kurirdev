import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User, AuthState, UserRole } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUserStore } from '@/stores/useUserStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { supabase } from '@/lib/supabaseClient';

interface AuthContextType extends AuthState {
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cachedUser = useSessionStore(state => state.user);
  const storeLogin = useSessionStore(state => state.login);
  const storeLogout = useSessionStore(state => state.logout);
  const storeUpdateUser = useSessionStore(state => state.updateUser);
  
  const [state, setState] = useState<AuthState>({
    user: cachedUser,
    token: null,
    isAuthenticated: !!cachedUser,
    isLoading: !cachedUser,
  });

  const lastTokenRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(cachedUser?.id || null);

  useEffect(() => {
    currentUserIdRef.current = state.user?.id || null;
  }, [state.user?.id]);

  const fetchProfile = useCallback(async (userId: string, email: string, isSilent: boolean = false) => {
    if (!isSilent) {
      setState(prev => ({ ...prev, isLoading: true }));
    }
    
    // Add a timeout to prevent infinite loading on shaky networks
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      const { data: profile, error } = (await profilePromise) as any;
      clearTimeout(timeoutId);
        
      if (error) throw error;
      
      if (profile) {
        if (profile.is_active === false) {
          console.warn('Account is inactive:', userId);
          await supabase.auth.signOut();
          storeLogout();
          setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
          return;
        }

        const userData: User = {
          id: profile.id,
          name: profile.name,
          email: email,
          role: profile.role as UserRole,
          phone: profile.phone || undefined,
          is_active: profile.is_active ?? true,
          fcm_token: profile.fcm_token || undefined,
          is_online: profile.is_online,
          courier_status: profile.courier_status,
          off_reason: profile.off_reason,
          vehicle_type: profile.vehicle_type,
          plate_number: profile.plate_number,
          queue_position: profile.queue_position,
          created_at: profile.created_at || new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString(),
          total_deliveries_alltime: profile.total_deliveries_alltime,
          total_earnings_alltime: profile.total_earnings_alltime,
          unpaid_count: profile.unpaid_count,
          unpaid_amount: profile.unpaid_amount,
        };
        storeLogin(userData); // Sync to Zustand
        setState({
          user: userData,
          token: null,
          isAuthenticated: true,
          isLoading: false, // Turn off loader once auth is verified
        });
      } else {
        console.error('Profile not found for:', userId);
        await supabase.auth.signOut();
        storeLogout();
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Error fetching profile from Supabase:', error);
      
      // If it's a silent refresh and it fails, we don't necessarily want to 
      // kick the user out immediately, but we must stop the loading state.
      setState(prev => ({ ...prev, isLoading: false }));
      
      // If NOT silent and it fails, it's a critical boot failure
      if (!isSilent && error.name !== 'AbortError') {
        // Option: we could allow offline access here if we have cachedUser
        if (cachedUser) {
           console.log('Falling back to cached user due to network error');
           setState({ user: cachedUser, token: null, isAuthenticated: true, isLoading: false });
        }
      }
    }
  }, [storeLogin, cachedUser]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session?.user) {
          // If we already have a cached user, we can do a silent refresh
          await fetchProfile(session.user.id, session.user.email || '', !!cachedUser);
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Supabase session error:', error);
        // If we have a cached user, don't kill the session immediately on network error
        if (!cachedUser) {
          storeLogout();
          setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Supabase Auth Event:', event);
      
      if (session?.access_token && session.access_token !== lastTokenRef.current) {
        // CRITICAL: Synchronize Realtime engine with the current JWT
        // This ensures WebSocket connections are correctly authorized for RLS-protected tables
        try {
          console.log('🔄 Syncing Realtime auth with new token');
          supabase.realtime.setAuth(session.access_token);
          lastTokenRef.current = session.access_token;
        } catch (e) {
          console.error('Failed to sync Realtime auth:', e);
        }
      }

      if (event === 'SIGNED_OUT') {
        storeLogout();
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        // Force fully close any pending realtime channels
        supabase.removeAllChannels();
        return;
      }

      if (session?.user) {
        // Re-fetch profile if context is fresh or token was refreshed
        if (currentUserIdRef.current === session.user.id && event === 'SIGNED_IN') {
          console.log('Session already active for user:', session.user.id);
          return;
        }
        
        // TOKEN_REFRESHED should always be silent
        const isSilent = event === 'TOKEN_REFRESHED' || !!currentUserIdRef.current;
        await fetchProfile(session.user.id, session.user.email || '', isSilent);
      }
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [fetchProfile, storeLogout]);

  const logout = useCallback(async () => {
    console.log('Initiating logout...');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during Supabase sign out:', err);
    }
    
    // Safety delay to let Supabase finish
    setTimeout(async () => {
      // Reset all global stores manually and carefully
      try { useSessionStore.getState().reset(); } catch(e) {}
      try { useUserStore.getState().reset(); } catch(e) {}
      try { useOrderStore.getState().reset(); } catch(e) {}
      try { useNotificationStore.getState().reset(); } catch(e) {}
      try { useSettingsStore.getState().reset(); } catch(e) {}
      
      try {
        const { useCourierStore } = await import('@/stores/useCourierStore');
        useCourierStore.getState().reset();
      } catch(e) {}
      
      // 2. Selective LocalStorage Cleanup (Secure)
      const keysToRemove = [
        'session-storage',
        'business-settings',
        'kurirdev_db_meta',
        'courier-storage'
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // 3. Clear IndexedDB Cache (Mirroring)
      try {
        const { clearAllCache } = await import('@/lib/orderCache');
        await clearAllCache();
      } catch(e) {}
      
      setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
      console.log('Logout cleanup complete.');
    }, 100);
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
