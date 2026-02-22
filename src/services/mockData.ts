import type {
  User,
  Order,
  OrderStatusHistory,
  Courier,
  CourierPerformance,
  DashboardAnalytics,
  RevenueChartData,
  Notification,
  ReportSummary,
  OrderStatus,
} from '@/types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: "1",
    name: 'Admin User',
    email: 'admin@delivery.com',
    role: 'admin',
    phone: '+62812345678',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: "2",
    name: 'Ahmad Kurniawan',
    email: 'ahmad@delivery.com',
    role: 'courier',
    phone: '+62811111111',
    is_active: true,
    is_online: true,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: "3",
    name: 'Budi Santoso',
    email: 'budi@delivery.com',
    role: 'courier',
    phone: '+62822222222',
    is_active: true,
    is_online: true,
    created_at: '2024-01-20T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
  },
  {
    id: "4",
    name: 'Citra Dewi',
    email: 'citra@delivery.com',
    role: 'courier',
    phone: '+62833333333',
    is_active: true,
    is_online: false,
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: "5",
    name: 'Dedi Pratama',
    email: 'dedi@delivery.com',
    role: 'courier',
    phone: '+62844444444',
    is_active: false,
    is_online: false,
    created_at: '2024-02-15T00:00:00Z',
    updated_at: '2024-02-15T00:00:00Z',
  },
];

// Generate mock orders
const statuses: OrderStatus[] = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
const customerNames = ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Brown', 'Charlie Davis', 'Diana Miller', 'Edward Jones', 'Fiona Garcia'];
const addresses = [
  'Jl. Sudirman No. 123, Jakarta Selatan',
  'Jl. Gatot Subroto No. 45, Jakarta Pusat',
  'Jl. Kemang Raya No. 78, Jakarta Selatan',
  'Jl. Senopati No. 90, Jakarta Selatan',
  'Jl. Rasuna Said No. 12, Jakarta Selatan',
  'Jl. Thamrin No. 56, Jakarta Pusat',
  'Jl. Kuningan No. 34, Jakarta Selatan',
  'Jl. Menteng No. 67, Jakarta Pusat',
];

function generateOrderNumber(index: number): string {
  const now = new Date();
  const DD = String(now.getDate()).padStart(2, '0');
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const YY = String(now.getFullYear()).slice(-2);
  return `P${DD}${MM}${YY}${String(index + 1).padStart(3, '0')}`;
}

function randomDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  date.setHours(Math.floor(Math.random() * 12) + 8);
  date.setMinutes(Math.floor(Math.random() * 60));
  return date.toISOString();
}

export const mockOrders: Order[] = Array.from({ length: 50 }, (_, i) => {
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const hasCourier = status !== 'pending' && status !== 'cancelled';
  const courierId = hasCourier ? ["2", "3", "4"][Math.floor(Math.random() * 3)] : undefined;
  
  return {
    id: String(i + 1),
    order_number: generateOrderNumber(i),
    customer_name: customerNames[Math.floor(Math.random() * customerNames.length)],
    customer_phone: `+6281${Math.floor(Math.random() * 900000000 + 100000000)}`,
    customer_address: addresses[Math.floor(Math.random() * addresses.length)],
    courier_id: courierId,
    assigned_at: hasCourier ? randomDate(5) : undefined,
    status,
    total_fee: 8000,
    payment_status: status === 'delivered' ? 'paid' : 'unpaid',
    estimated_delivery_time: randomDate(0),
    actual_pickup_time: ['picked_up', 'in_transit', 'delivered'].includes(status) ? randomDate(3) : undefined,
    actual_delivery_time: status === 'delivered' ? randomDate(2) : undefined,
    cancelled_at: status === 'cancelled' ? randomDate(3) : undefined,
    cancellation_reason: status === 'cancelled' ? 'Customer requested cancellation' : undefined,
    created_at: randomDate(7),
    updated_at: randomDate(3),
    created_by: "1",
  };
});

// Mock status history
export const mockStatusHistory: OrderStatusHistory[] = [
  { id: "1", order_id: "1", status: 'pending', changed_by: "1", changed_by_name: 'Admin User', changed_at: '2024-02-15T08:00:00Z' },
  { id: "2", order_id: "1", status: 'assigned', changed_by: "1", changed_by_name: 'Admin User', changed_at: '2024-02-15T08:30:00Z' },
  { id: "3", order_id: "1", status: 'picked_up', changed_by: "2", changed_by_name: 'Ahmad Kurniawan', changed_at: '2024-02-15T09:00:00Z' },
];

// Mock couriers with stats
export const mockCouriers: Courier[] = mockUsers
  .filter(u => u.role === 'courier')
  .map(u => ({
    ...u,
  }));

// Mock courier performance
export const mockCourierPerformance: CourierPerformance = {
  total_orders: 150,
  completed_orders: 140,
  cancelled_orders: 10,
  total_earnings: 896000,
  average_delivery_time: 45,
  recent_orders: mockOrders.slice(0, 10),
};

// Mock dashboard analytics
export const mockAnalytics: DashboardAnalytics = {
  total_orders_today: 45,
  total_revenue_today: 360000,
  active_couriers: 8,
  pending_orders: 12,
  orders_by_status: [
    { status: 'pending', count: 12 },
    { status: 'assigned', count: 8 },
    { status: 'picked_up', count: 5 },
    { status: 'in_transit', count: 10 },
    { status: 'delivered', count: 35 },
    { status: 'cancelled', count: 3 },
  ],
};

// Mock revenue chart data
export const mockRevenueChart: RevenueChartData[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (6 - i));
  return {
    date: date.toISOString().slice(0, 10),
    revenue: Math.floor(Math.random() * 500000) + 200000,
    orders: Math.floor(Math.random() * 50) + 20,
  };
});

// Mock notifications
export const mockNotifications: Notification[] = [
  {
    id: "1",
    user_id: "2",
    user_name: 'Ahmad Kurniawan',
    title: 'New Order Assigned',
    body: 'Order #ORD-20240215-0001 has been assigned to you',
    data: { order_id: "1" },
    is_read: true,
    sent_at: '2024-02-15T08:30:00Z',
  },
  {
    id: "2",
    user_id: "3",
    user_name: 'Budi Santoso',
    title: 'New Order Assigned',
    body: 'Order #ORD-20240215-0002 has been assigned to you',
    data: { order_id: "2" },
    is_read: false,
    sent_at: '2024-02-15T09:00:00Z',
  },
];

// Mock report summary
export const mockReportSummary: ReportSummary = {
  total_orders: 320,
  total_revenue: 2560000,
  average_orders_per_day: 45.7,
  top_courier: {
    id: "2",
    name: 'Ahmad Kurniawan',
    orders_count: 85,
    earnings: 544000,
  },
  orders_by_status: [
    { status: 'pending', count: 0 },
    { status: 'assigned', count: 0 },
    { status: 'picked_up', count: 0 },
    { status: 'in_transit', count: 0 },
    { status: 'delivered', count: 300 },
    { status: 'cancelled', count: 20 },
  ],
};
