import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Courier } from '@/types';
import { useUserStore } from './useUserStore';

interface CourierState {
    couriers: Courier[];
    queue: Courier[]; // FIFO Queue

    initializeQueue: () => void;
    addCourier: (courier: Courier) => void;
    updateCourierStatus: (id: number, status: Partial<Courier>) => void;
    suspendCourier: (id: number, isSuspended: boolean) => void;

    // Queue Logic
    rotateQueue: (courierId: number) => void; // Move courier to back after assignment
    getAvailableCouriers: () => Courier[]; // Get online and active couriers sorted by Queue order
}

// Initial Courier Data (Linked to Users 3, 4, 5)
const INITIAL_COURIERS: Courier[] = [
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
        vehicle_type: 'motorcycle',
        plate_number: 'B 1234 XY',
        commission_rate: 80,
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
        vehicle_type: 'motorcycle',
        plate_number: 'B 5678 AB',
        commission_rate: 80,
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
        vehicle_type: 'motorcycle',
        plate_number: 'B 9012 CD',
        commission_rate: 80,
    },
];

export const useCourierStore = create<CourierState>()(
    persist(
        (set, get) => ({
            couriers: INITIAL_COURIERS,
            queue: INITIAL_COURIERS, // Initially same order

            initializeQueue: () => {
                // Ensure queue has all couriers
                const currentQueueIds = get().queue.map(c => c.id);
                const missing = get().couriers.filter(c => !currentQueueIds.includes(c.id));
                if (missing.length > 0) {
                    set(state => ({ queue: [...state.queue, ...missing] }));
                }
            },

            addCourier: (courier) => {
                // Sync with UserStore (Side Effect outside set)
                useUserStore.getState().addUser({
                    id: courier.id,
                    name: courier.name,
                    email: courier.email,
                    password: courier.password,
                    role: 'courier',
                    phone: courier.phone,
                    is_active: true,
                    created_at: courier.created_at,
                    updated_at: courier.updated_at,
                });

                set((state) => ({
                    couriers: [...state.couriers, courier],
                    queue: [...state.queue, courier],
                }));
            },

            updateCourierStatus: (id, status) => {
                // Sync with UserStore
                useUserStore.getState().updateUser(id, status);

                set((state) => {
                    const updatedCouriers = state.couriers.map((c) => (c.id === id ? { ...c, ...status } : c));

                    let updatedQueue = state.queue.map(c => (c.id === id ? { ...c, ...status } : c));

                    // If turning Online, move to back of queue
                    if (status.is_online === true) {
                        const courierInQueue = updatedQueue.find(c => c.id === id);
                        if (courierInQueue) {
                            updatedQueue = updatedQueue.filter(c => c.id !== id);
                            updatedQueue.push(courierInQueue);
                        }
                    }

                    return { couriers: updatedCouriers, queue: updatedQueue };
                });
            },

            suspendCourier: (id, isSuspended) => {
                // Sync with UserStore
                useUserStore.getState().updateUser(id, { is_active: !isSuspended });

                set((state) => {
                    return {
                        couriers: state.couriers.map((c) => (c.id === id ? { ...c, is_active: !isSuspended } : c)),
                    };
                });
            },

            rotateQueue: (courierId) =>
                set((state) => {
                    const courier = state.queue.find((c) => c.id === courierId);
                    if (!courier) return state;

                    const newQueue = state.queue.filter((c) => c.id !== courierId);
                    newQueue.push(courier); // Move to back
                    return { queue: newQueue };
                }),

            getAvailableCouriers: () => {
                const { queue } = get();
                return queue.filter((c) => c.is_active && c.is_online);
            },
        }),
        {
            name: 'courier-storage',
        }
    )
);
