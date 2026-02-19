import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Courier } from '@/types';
import { useUserStore } from './useUserStore';

interface CourierState {
    couriers: Courier[];
    addCourier: (courier: Courier) => void;
    updateCourier: (id: number, data: Partial<Courier>) => void;
    removeCourier: (id: number) => void;
    getAvailableCouriers: () => Courier[];
    rotateQueue: (id: number) => void;
}

// Initial Data matched with INITIAL_USERS in useUserStore
const INITIAL_COURIERS: Courier[] = [
    {
        id: 2,
        name: 'Budi Santoso',
        email: 'budi@kurir.com',
        role: 'courier',
        password: 'courier123',
        phone: '+628123456789',
        is_active: true,
        is_online: true,
        vehicle_type: 'motorcycle',
        plate_number: 'B 1234 ABC',
        commission_rate: 80,
        active_orders_count: 0,
        total_completed: 45,
        total_earnings: 1250000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 3,
        name: 'Siti Aminah',
        email: 'siti@kurir.com',
        role: 'courier',
        password: 'courier123',
        phone: '+628123456790',
        is_active: true,
        is_online: true,
        vehicle_type: 'motorcycle',
        plate_number: 'B 5678 DEF',
        commission_rate: 80,
        active_orders_count: 1,
        total_completed: 32,
        total_earnings: 850000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 4,
        name: 'Agus Prayitno',
        email: 'agus@kurir.com',
        role: 'courier',
        password: 'courier123',
        phone: '+628123456791',
        is_active: true,
        is_online: false,
        vehicle_type: 'bicycle',
        plate_number: '-',
        commission_rate: 80,
        active_orders_count: 0,
        total_completed: 12,
        total_earnings: 340000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
];

export const useCourierStore = create<CourierState>()(
    persist(
        (set, get) => ({
            couriers: INITIAL_COURIERS,

            addCourier: (courier) => {
                set((state) => ({
                    couriers: [...state.couriers, courier]
                }));
                // Sync to user database
                useUserStore.getState().addUser(courier);
            },

            updateCourier: (id, data) => {
                set((state) => ({
                    couriers: state.couriers.map((c) =>
                        c.id === id ? { ...c, ...data, updated_at: new Date().toISOString() } : c
                    ),
                }));
                // Sync to user database
                useUserStore.getState().updateUser(id, data);
            },

            removeCourier: (id) => {
                set((state) => ({
                    couriers: state.couriers.filter((c) => c.id !== id),
                }));
                // Sync to user database
                useUserStore.getState().removeUser(id);
            },

            getAvailableCouriers: () => {
                return get().couriers.filter(c => c.is_active && c.is_online);
            },

            rotateQueue: (id) => {
                // Move the recently assigned courier to the end of the list for basic FIFO load balancing
                set((state) => {
                    const index = state.couriers.findIndex(c => c.id === id);
                    if (index === -1) return state;

                    const newCouriers = [...state.couriers];
                    const [courier] = newCouriers.splice(index, 1);
                    newCouriers.push(courier);

                    return { couriers: newCouriers };
                });
            },
        }),
        {
            name: 'courier-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
