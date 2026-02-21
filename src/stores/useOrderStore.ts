import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Order, OrderStatus, OrderStatusHistory } from '@/types';
import { useNotificationStore } from './useNotificationStore';
import { sendMockNotification } from '@/utils/notification';

interface OrderState {
    _storeVersion: string;
    orders: Order[];
    statusHistory: Record<string, OrderStatusHistory[]>;

    resetStore: () => void;
    initializeOrders: () => void;
    addOrder: (order: Order) => void;
    updateOrderStatus: (orderId: string, status: OrderStatus, userId: string, userName: string, notes?: string) => void;
    assignCourier: (orderId: string, courierId: string, courierName: string, userId: string, userName: string) => void;
    cancelOrder: (orderId: string, reason: string, userId: string, userName: string) => void;
    updateOrder: (orderId: string, updates: Partial<Order>) => void;

    // Helpers
    generateOrderId: () => string;
    getOrdersByCourier: (courierId: string) => Order[];
    getRecentOrders: (limit?: number) => Order[];
}



const generateMockOrders = (): Order[] => {
    const orders: Order[] = [];
    const statuses: OrderStatus[] = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];

    for (let i = 1; i <= 50; i++) {
        // Use deterministic "random" based on ID
        const daysAgo = i % 7;
        const dateStr = new Date();
        dateStr.setDate(dateStr.getDate() - daysAgo);
        const dateYMD = dateStr.toISOString().slice(0, 10).replace(/-/g, '');

        const statusIdx = (i * 13) % statuses.length;
        const status = statuses[statusIdx];
        const isCompleted = status === 'delivered';
        const hasCourier = status !== 'pending' && status !== 'cancelled';

        const courierId = hasCourier ? String((i % 3) + 3) : undefined;
        const courierNames: Record<string, string> = { "3": 'Budi Santoso', "4": 'Siti Aminah', "5": 'Agus Pratama' };
        const courierName = courierId ? courierNames[courierId] : undefined;

        orders.push({
            id: String(i),
            order_number: `ORD-${dateYMD}-${String(i).padStart(3, '0')}`,
            customer_name: `Customer ${i}`,
            customer_phone: `+6281${String(i).padStart(8, '0')}`,
            customer_address: `Jl. Contoh No. ${i}, Jakarta`,
            courier_id: courierId,
            status: status,
            total_fee: 15000 + ((i % 10) * 1000),
            payment_status: isCompleted ? 'paid' : 'unpaid',
            created_at: dateStr.toISOString(),
            updated_at: dateStr.toISOString(),
            created_by: "1"
        });
    }
    return orders;
};

const STORE_VERSION = '1.0.4';

export const useOrderStore = create<OrderState>()(
    persist(
        (set, get) => ({
            _storeVersion: STORE_VERSION,
            orders: [], // Start empty, initialize logically
            statusHistory: {},

            resetStore: () => set({ orders: [], statusHistory: {}, _storeVersion: STORE_VERSION }),

            initializeOrders: () => {
                if (get().orders.length === 0) {
                    set({ orders: generateMockOrders() });
                }
            },

            addOrder: (order) => {
                set((state) => ({ orders: [order, ...state.orders] }));

                // Simulate PWA Push Notification for "Wow" factor
                sendMockNotification(
                    'Order Baru Masuk!',
                    `Order ${order.order_number} sebesar Rp ${order.total_fee.toLocaleString('id-ID')} menunggumu!`,
                    { orderId: order.id }
                );
            },

            updateOrderStatus: (orderId, status, userId, userName, notes) =>
                set((state) => {
                    const updatedOrders = state.orders.map((o) => {
                        if (o.id !== orderId) return o;

                        const updates: Partial<Order> = {
                            status,
                            updated_at: new Date().toISOString()
                        };

                        if (status === 'picked_up' && !o.actual_pickup_time) {
                            updates.actual_pickup_time = new Date().toISOString();
                        } else if (status === 'delivered' && !o.actual_delivery_time) {
                            updates.actual_delivery_time = new Date().toISOString();
                        }

                        return { ...o, ...updates };
                    });

                    const newHistory: OrderStatusHistory = {
                        id: crypto.randomUUID(),
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
                set((state) => {
                    const updatedOrders = state.orders.map(o => o.id === orderId ? { ...o, courier_id: courierId, assigned_at: new Date().toISOString() } : o);

                    // Trigger Notification
                    useNotificationStore.getState().addNotification({
                        user_id: courierId,
                        title: 'New Order Assigned',
                        body: `Order ${state.orders.find(o => o.id === orderId)?.order_number} has been assigned to you.`,
                        data: { orderId }
                    });

                    return { orders: updatedOrders };
                });
            },

            cancelOrder: (orderId, reason, userId, userName) => {
                get().updateOrderStatus(orderId, 'cancelled', userId, userName, reason);
                set((state) => ({
                    orders: state.orders.map(o => o.id === orderId ? { ...o, cancellation_reason: reason } : o)
                }));
            },

            updateOrder: (orderId, updates) => set((state) => ({
                orders: state.orders.map((o) =>
                    o.id === orderId ? { ...o, ...updates, updated_at: new Date().toISOString() } : o
                ),
            })),

            generateOrderId: () => {
                const now = new Date();
                const DD = String(now.getDate()).padStart(2, '0');
                const MM = String(now.getMonth() + 1).padStart(2, '0');
                const YY = String(now.getFullYear()).slice(-2);
                const dateKey = `${DD}${MM}${YY}`;
                const todayOrders = get().orders.filter(o => o.order_number.startsWith(`P${dateKey}`));
                const count = todayOrders.length + 1;
                return `P${dateKey}${String(count).padStart(3, '0')}`;
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
            onRehydrateStorage: () => (state) => {
                if (state && state._storeVersion !== STORE_VERSION) {
                    console.warn('Store version mismatch — resetting order-storage');
                    state.resetStore();
                }
            }
        }
    )
);
