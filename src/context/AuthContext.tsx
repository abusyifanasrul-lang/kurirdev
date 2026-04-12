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

  // ─── PERBAIKAN UTAMA ──────────────────────────────────────────
  // Simpan cachedUser dalam ref agar TIDAK masuk ke dependency array
  // useCallback. Tanpa ini: storeLogin() → cachedUser berubah →
  // fetchProfile direkrasi → useEffect re-run → onAuthStateChange
  // re-register → Supabase fires SIGNED_IN lagi → infinite loop.
  // ─────────────────────────────────────────────────────────────
  const cachedUserRef = useRef(cachedUser);
  useEffect(() => {
    cachedUserRef.current = cachedUser;
  });

  const fetchInProgress = useRef(false);
  const lastFetchTime = useRef(0);
  const lastTokenRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(cachedUser?.id || null);

  useEffect(() => {
    currentUserIdRef.current = state.user?.id || null;
  }, [state.user?.id]);

  // fetchProfile TIDAK lagi bergantung pada cachedUser (hanya storeLogin yang stabil)
  const fetchProfile = useCallback(async (userId: string, email: string, isSilent: boolean = false) => {
    if (fetchInProgress.current) return;
    if (Date.now() - lastFetchTime.current < 2000) return;

    fetchInProgress.current = true;
    lastFetchTime.current = Date.now();

    if (!isSilent) {
      setState(prev => ({ ...prev, isLoading: true }));
    }

    const timeoutId = setTimeout(() => {
      fetchInProgress.current = false;
    }, 15000);

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (profile) {
        if (profile.is_active === false) {
          await supabase.auth.signOut();
          storeLogout();
          setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
          return;
        }

        const userData: User = {
          id: profile.id,
          email: email,
          name: profile.name,
          role: profile.role as UserRole,
          phone: profile.phone || undefined,
          is_active: profile.is_active ?? true,
          fcm_token: profile.fcm_token || undefined,
          is_online: profile.is_online ?? false,
          courier_status: (profile.courier_status as any) || undefined,
          off_reason: profile.off_reason || undefined,
          vehicle_type: (profile.vehicle_type as any) || undefined,
          plate_number: profile.plate_number || undefined,
          queue_position: profile.queue_position || undefined,
          total_deliveries_alltime: profile.total_deliveries_alltime || 0,
          total_earnings_alltime: profile.total_earnings_alltime || 0,
          unpaid_count: profile.unpaid_count || 0,
          unpaid_amount: profile.unpaid_amount || 0,
          created_at: profile.created_at || new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString(),
        };
        storeLogin(userData);
        setState({ user: userData, token: null, isAuthenticated: true, isLoading: false });
      }
    } catch (error: any) {
      console.error('[Auth] Profile fetch failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      clearTimeout(timeoutId);
      fetchInProgress.current = false;
      setState(prev => ({ ...prev, isLoading: false }));
    }
  // ─── PERBAIKAN: cachedUser DIHAPUS dari deps ──────────────────
  // Sebelumnya: [storeLogin, cachedUser] → loop
  // Sekarang:   [storeLogin, storeLogout] → stabil selamanya
  // cachedUser dibaca via cachedUserRef.current saat dibutuhkan
  // ─────────────────────────────────────────────────────────────
  }, [storeLogin, storeLogout]);

  useEffect(() => {
    // checkSession hanya dijalankan sekali saat mount
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          // Gunakan cachedUserRef.current (bukan cachedUser langsung)
          // agar tidak menciptakan dependency yang menyebabkan re-run
          const hasCached = !!cachedUserRef.current;
          await fetchProfile(session.user.id, session.user.email || '', hasCached);
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Supabase session error:', error);
        if (!cachedUserRef.current) {
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

      // JWT refresh — hanya sync token, TIDAK trigger fetchProfile atau custom event
      if (session?.access_token && session.access_token !== lastTokenRef.current) {
        try {
          supabase.realtime.setAuth(session.access_token);
          lastTokenRef.current = session.access_token;
          console.log('🔑 Realtime JWT synced.');
          // ─── PERBAIKAN: HAPUS custom event dispatch ───────────────
          // window.dispatchEvent(new CustomEvent('supabase-realtime-auth-synced'))
          // Event ini menyebabkan AppListeners trigger fillDataGap/recovery
          // setiap kali token di-refresh (setiap jam), yang tidak perlu.
          // setAuth() sudah cukup — WebSocket otomatis menggunakan token baru.
          // ─────────────────────────────────────────────────────────
        } catch (e) {
          console.error('Failed to sync Realtime auth:', e);
        }
      }

      if (event === 'SIGNED_OUT') {
        storeLogout();
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        supabase.removeAllChannels();
        return;
      }

      // SIGNED_IN untuk user yang sama — skip fetchProfile sepenuhnya
      // Ini mencegah loop: fetchProfile → storeLogin → re-render → re-register listener
      if (event === 'SIGNED_IN' && currentUserIdRef.current === session?.user?.id) {
        console.log('Session already active for user:', session?.user?.id, '— skipping refetch.');
        return;
      }

      // TOKEN_REFRESHED — token sudah di-sync di atas, tidak perlu fetchProfile
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      if (session?.user) {
        const isSilent = !!currentUserIdRef.current;
        await fetchProfile(session.user.id, session.user.email || '', isSilent);
      }
    });

    // Listener ini hanya didaftarkan SEKALI (deps array kosong)
    // Karena fetchProfile sekarang stabil (tidak bergantung cachedUser)
    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  // ─── PERBAIKAN: deps array minimal dan stabil ─────────────────
  // fetchProfile stabil → useEffect ini TIDAK pernah re-run
  // = onAuthStateChange hanya didaftarkan SATU kali seumur hidup app
  // ─────────────────────────────────────────────────────────────
  }, [fetchProfile, storeLogout]);

  const logout = useCallback(async () => {
    console.log('Initiating logout...');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during Supabase sign out:', err);
    }

    setTimeout(async () => {
      try { useSessionStore.getState().reset(); } catch(e) {}
      try { useUserStore.getState().reset(); } catch(e) {}
      try { useOrderStore.getState().reset(); } catch(e) {}
      try { useNotificationStore.getState().reset(); } catch(e) {}
      try { useSettingsStore.getState().reset(); } catch(e) {}

      try {
        const { useCourierStore } = await import('@/stores/useCourierStore');
        useCourierStore.getState().reset();
      } catch(e) {}

      const keysToRemove = ['session-storage', 'business-settings', 'kurirdev_db_meta', 'courier-storage'];
      keysToRemove.forEach(key => localStorage.removeItem(key));

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
