import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';

interface UserState {
    _storeVersion: string;
    users: User[]; // Combined list of Admins and Couriers

    resetStore: () => void;
    addUser: (user: User) => void;
    removeUser: (id: number) => void;
    updateUser: (id: number, data: Partial<User>) => void;
}

// Initial Mock Data with strict passwords
const INITIAL_USERS: User[] = [
    {
        id: 1,
        name: 'Super Admin',
        email: 'admin@delivery.com',
        role: 'admin',
        password: 'admin123',
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
        password: 'admin123',
        phone: '+6281234567891',
        is_active: true,
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-01T00:00:00Z',
    },
    {
        id: 3,
        name: 'Budi Santoso',
        email: 'budi@courier.com',
        role: 'courier',
        password: 'courier123',
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
        password: 'courier123',
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
        password: 'courier123',
        phone: '+6281876543210',
        is_active: true,
        is_online: true,
        created_at: '2024-02-10T00:00:00Z',
        updated_at: '2024-02-10T00:00:00Z',
    },
];

const STORE_VERSION = '1.0.4';

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            _storeVersion: STORE_VERSION,
            users: INITIAL_USERS,

            resetStore: () => set({ users: INITIAL_USERS, _storeVersion: STORE_VERSION }),

            addUser: (user) => set((state) => ({ users: [...state.users, user] })),
            removeUser: (id) =>
                set((state) => {
                    if (id === 1) return state; // Prevent deleting Super Admin
                    return { users: state.users.filter((u) => u.id !== id) };
                }),
            updateUser: (id, data) =>
                set((state) => ({
                    users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
                })),
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                if (state && state._storeVersion !== STORE_VERSION) {
                    console.warn('Store version mismatch — resetting user-storage');
                    state.resetStore();
                }
            }
        }
    )
);
