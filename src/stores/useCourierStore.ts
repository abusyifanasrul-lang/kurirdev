import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Courier } from '@/types';
import { useUserStore } from './useUserStore';

interface CourierState {
    _storeVersion: string;
    couriers: Courier[];
    queue: Courier[];

    resetStore: () => void;
    addCourier: (courier: Courier) => void;
    updateCourier: (id: string, data: Partial<Courier>) => void;
    updateCourierStatus: (id: string, data: Partial<Courier>) => void;
    removeCourier: (id: string) => void;
    getAvailableCouriers: () => Courier[];
    rotateQueue: (id: string) => void;
}

// Initial Data matched with INITIAL_USERS in useUserStore
const INITIAL_COURIERS: Courier[] = [
    {
        id: "3",
        name: 'Budi Santoso',
        email: 'budi@courier.com',
        role: 'courier',
        password: 'courier123',
        phone: '+6281298765432',
        is_active: true,
        is_online: true,
        vehicle_type: 'motorcycle',
        plate_number: 'B 1234 ABC',
        commission_rate: 80,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
    },
    {
        id: "4",
        name: 'Siti Aminah',
        email: 'siti@courier.com',
        role: 'courier',
        password: 'courier123',
        phone: '+6281345678901',
        is_active: true,
        is_online: true,
        vehicle_type: 'motorcycle',
        plate_number: 'B 5678 DEF',
        commission_rate: 80,
        created_at: '2024-01-20T00:00:00Z',
        updated_at: '2024-01-20T00:00:00Z',
    },
    {
        id: "5",
        name: 'Agus Pratama',
        email: 'agus@courier.com',
        role: 'courier',
        password: 'courier123',
        phone: '+6281876543210',
        is_active: true,
        is_online: false,
        vehicle_type: 'bicycle',
        plate_number: '-',
        commission_rate: 80,
        created_at: '2024-02-10T00:00:00Z',
        updated_at: '2024-02-10T00:00:00Z',
    },
];

const STORE_VERSION = '1.0.4';

export const useCourierStore = create<CourierState>()(
    persist(
        (set, get) => ({
            _storeVersion: STORE_VERSION,
            couriers: INITIAL_COURIERS,
            queue: INITIAL_COURIERS,

            resetStore: () => set({ couriers: INITIAL_COURIERS, queue: INITIAL_COURIERS, _storeVersion: STORE_VERSION }),

            addCourier: (courier) => {
                set((state) => ({
                    couriers: [...state.couriers, courier],
                    queue: [...state.queue, courier]
                }));
                // Sync to user database
                useUserStore.getState().addUser(courier);
            },

            updateCourier: (id, data) => {
                set((state) => {
                    const updatedCouriers = state.couriers.map((c) =>
                        c.id === id ? { ...c, ...data, updated_at: new Date().toISOString() } : c
                    );
                    const updatedQueue = state.queue.map((c) =>
                        c.id === id ? { ...c, ...data, updated_at: new Date().toISOString() } : c
                    );
                    return {
                        couriers: updatedCouriers,
                        queue: updatedQueue
                    };
                });
                // Sync to user database
                useUserStore.getState().updateUser(id, data);
            },

            updateCourierStatus: (id, data) => {
                get().updateCourier(id, data);
            },

            removeCourier: (id) => {
                set((state) => ({
                    couriers: state.couriers.filter((c) => c.id !== id),
                    queue: state.queue.filter((c) => c.id !== id),
                }));
                // Sync to user database
                useUserStore.getState().removeUser(id);
            },

            getAvailableCouriers: () => {
                return get().queue.filter(c => c.is_active && c.is_online);
            },

            rotateQueue: (id) => {
                // Move the recently assigned courier to the end of the list for basic FIFO load balancing
                set((state) => {
                    const index = state.queue.findIndex(c => c.id === id);
                    if (index === -1) return state;

                    const newQueue = [...state.queue];
                    const [courier] = newQueue.splice(index, 1);
                    newQueue.push(courier);

                    return { queue: newQueue };
                });
            },
        }),
        {
            name: 'courier-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                if (state && state._storeVersion !== STORE_VERSION) {
                    console.warn('Store version mismatch — resetting courier-storage');
                    state.resetStore();
                }
            }
        }
    )
);
