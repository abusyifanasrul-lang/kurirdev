import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Order, OrderStatus, OrderStatusHistory } from '@/types';

interface OrderState {
    orders: Order[];
    statusHistory: Record<number, OrderStatusHistory[]>;

    initializeOrders: () => void;
    addOrder: (order: Order) => void;
    updateOrderStatus: (orderId: number, status: OrderStatus, userId: number, userName: string, notes?: string) => void;
    assignCourier: (orderId: number, courierId: number, courierName: string, userId: number, userName: string) => void;
    cancelOrder: (orderId: number, reason: string, userId: number, userName: string) => void;

    // Helpers
    generateOrderId: () => string;
    getOrdersByCourier: (courierId: number) => Order[];
    getRecentOrders: (limit?: number) => Order[];
}

// Helper to generate distinct dates for the last 7 days
const getDateDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
};

const generateMockOrders = (): Order[] => {
    const orders: Order[] = [];
    const statuses: OrderStatus[] = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];

    for (let i = 1; i <= 50; i++) {
        const daysAgo = Math.floor(Math.random() * 7); // 0 to 6 days ago
        const dateStr = new Date();
        dateStr.setDate(dateStr.getDate() - daysAgo);
        const dateYMD = dateStr.toISOString().slice(0, 10).replace(/-/g, '');

        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const isCompleted = status === 'delivered';
        const hasCourier = status !== 'pending' && status !== 'cancelled';

        // Distribute among couriers 3, 4, 5
        const courierId = hasCourier ? (i % 3) + 3 : undefined;
        const courierName = courierId === 3 ? 'Budi Santoso' : courierId === 4 ? 'Siti Aminah' : 'Agus Pratama';

        orders.push({
            id: i,
            order_number: `ORD-${dateYMD}-${String(i).padStart(3, '0')}`,
            customer_name: `Customer ${i}`,
            customer_phone: `+6281${String(i).padStart(8, '0')}`,
            customer_address: `Jl. Contoh No. ${i}, Jakarta`,
            courier_id: courierId,
            courier_name: hasCourier ? courierName : undefined,
            status: status,
            total_fee: 15000 + (Math.floor(Math.random() * 10) * 1000),
            payment_status: isCompleted ? 'paid' : 'unpaid',
            created_at: getDateDaysAgo(daysAgo),
            updated_at: getDateDaysAgo(daysAgo),
            created_by: 1
        });
    }
    return orders;
};

export const useOrderStore = create<OrderState>()(
    persist(
        (set, get) => ({
            orders: generateMockOrders(),
            statusHistory: {}, // Can populate if needed, but empty start is fine for simplified mock

            initializeOrders: () => {
                // Logic to maybe fetch or re-validate if needed
            },

            addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),

            updateOrderStatus: (orderId, status, userId, userName, notes) =>
                set((state) => {
                    const updatedOrders = state.orders.map((o) =>
                        o.id === orderId ? { ...o, status, updated_at: new Date().toISOString() } : o
                    );

                    const newHistory: OrderStatusHistory = {
                        id: Date.now(), // simple unique id
                        order_id: orderId,
                        status,
                        changed_by: userId,
                        changed_by_name: userName,
                        changed_at: new Date().toISOString(),
                        notes
                    };

                    const currentHistory = state.statusHistory[orderId] || [];

                    return {
                        orders: updatedOrders,
                        statusHistory: { ...state.statusHistory, [orderId]: [...currentHistory, newHistory] }
                    };
                }),

            assignCourier: (orderId, courierId, courierName, userId, userName) => {
                get().updateOrderStatus(orderId, 'assigned', userId, userName, `Assigned to ${courierName}`);
                set((state) => ({
                    orders: state.orders.map(o => o.id === orderId ? { ...o, courier_id: courierId, courier_name: courierName } : o)
                }));
            },

            cancelOrder: (orderId, reason, userId, userName) => {
                get().updateOrderStatus(orderId, 'cancelled', userId, userName, reason);
                set((state) => ({
                    orders: state.orders.map(o => o.id === orderId ? { ...o, cancellation_reason: reason } : o)
                }));
            },

            generateOrderId: () => {
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                // Find max ID for today to increment
                const todayOrders = get().orders.filter(o => o.order_number.includes(dateStr));
                const count = todayOrders.length + 1;
                return `ORD-${dateStr}-${String(count).padStart(3, '0')}`;
            },

            getOrdersByCourier: (courierId) => {
                return get().orders.filter(o => o.courier_id === courierId);
            },

            getRecentOrders: (limit = 5) => {
                return [...get().orders]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, limit);
            }
        }),
        {
            name: 'order-storage',
        }
    )
);
