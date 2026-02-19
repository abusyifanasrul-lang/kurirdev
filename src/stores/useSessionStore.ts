import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';

interface SessionState {
    user: User | null;
    isAuthenticated: boolean;
    setSession: (user: User) => void;
    clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            setSession: (user) => set({ user, isAuthenticated: true }),
            clearSession: () => set({ user: null, isAuthenticated: false }),
        }),
        {
            name: 'session-storage',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
