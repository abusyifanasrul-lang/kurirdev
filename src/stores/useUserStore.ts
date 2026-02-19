import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Courier, CourierPerformance } from '@/types';

interface UserState {
    user: User | null;
    users: User[]; // Combined list of Admins and Couriers for Settings page
    isAuthenticated: boolean;
    login: (user: User) => void;
    logout: () => void;
    addUser: (user: User) => void;
    removeUser: (id: number) => void;
    updateUser: (id: number, data: Partial<User>) => void;
}

// Initial Mock Data
const INITIAL_USERS: User[] = [
    {
        id: 1,
        name: 'Super Admin',
        email: 'admin@delivery.com',
        role: 'admin',
        phone: '+6281234567890',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 2,
        name: 'Admin Operational',
        email: 'ops@delivery.com',
        role: 'admin',
        phone: '+6281234567891',
        is_active: true,
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-01T00:00:00Z',
    },
    // Couriers will be synced/added here or managed via CourierStore and synced
    // For simplicity in this "No Backend" setup, we'll keep a master user list here
    {
        id: 3,
        name: 'Budi Santoso',
        email: 'budi@courier.com',
        role: 'courier',
        phone: '+6281298765432',
        is_active: true,
        is_online: true,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
    },
    {
        id: 4,
        name: 'Siti Aminah',
        email: 'siti@courier.com',
        role: 'courier',
        phone: '+6281345678901',
        is_active: true,
        is_online: false,
        created_at: '2024-01-20T00:00:00Z',
        updated_at: '2024-01-20T00:00:00Z',
    },
    {
        id: 5,
        name: 'Agus Pratama',
        email: 'agus@courier.com',
        role: 'courier',
        phone: '+6281876543210',
        is_active: true,
        is_online: true,
        created_at: '2024-02-10T00:00:00Z',
        updated_at: '2024-02-10T00:00:00Z',
    },
];

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            users: INITIAL_USERS,
            isAuthenticated: false,
            login: (user) => set({ user, isAuthenticated: true }),
            logout: () => set({ user: null, isAuthenticated: false }),
            addUser: (user) => set((state) => ({ users: [...state.users, user] })),
            removeUser: (id) =>
                set((state) => {
                    // Prevent deleting Super Admin (ID 1)
                    if (id === 1) return state;
                    return { users: state.users.filter((u) => u.id !== id) };
                }),
            updateUser: (id, data) =>
                set((state) => ({
                    users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
                    // Update current session user if it matches
                    user: state.user?.id === id ? { ...state.user, ...data } : state.user,
                })),
        }),
        {
            name: 'user-storage',
            storage: {
                getItem: (name) => {
                    const str = sessionStorage.getItem(name);
                    if (!str) return null;
                    return JSON.parse(str);
                },
                setItem: (name, value) => {
                    sessionStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => sessionStorage.removeItem(name),
            },
        }
    )
);
