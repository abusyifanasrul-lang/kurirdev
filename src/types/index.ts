// User types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'courier';
  password?: string;
  phone?: string;
  is_active: boolean;
  is_online?: boolean;
  fcm_token?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Order types
export type OrderStatus = 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid';

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  courier_id?: string;
  assigned_at?: string;
  status: OrderStatus;
  total_fee: number;
  payment_status: PaymentStatus;
  estimated_delivery_time?: string;
  actual_pickup_time?: string;
  actual_delivery_time?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  titik?: number;
  total_biaya_titik?: number;
  beban?: { nama: string; biaya: number }[];
  total_biaya_beban?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
  item_name?: string;
  item_price?: number;
  items?: { nama: string; harga: number }[];
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string;
  changed_by_name?: string;
  changed_at: string;
  notes?: string;
}

export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_fee?: number;
  payment_status?: PaymentStatus;
  estimated_delivery_time?: string;
  items?: { nama: string; harga: number }[];
}

// Courier types
export interface Courier extends User {
  vehicle_type?: 'motorcycle' | 'car' | 'bicycle' | 'van';
  plate_number?: string;
  commission_rate?: number; // 0-100, default 80 (80% to courier)
}

export interface CourierPerformance {
  total_orders: number;
  completed_orders: number;
  total_deliveries?: number; // Added for compatibility if needed
  cancelled_orders: number;
  total_earnings: number;
  average_delivery_time?: number;
  recent_orders: Order[];
}

// Dashboard analytics
export interface DashboardAnalytics {
  total_orders_today: number;
  total_revenue_today: number;
  active_couriers: number;
  pending_orders: number;
  orders_by_status: {
    status: OrderStatus;
    count: number;
  }[];
}

export interface RevenueChartData {
  date: string;
  revenue: number;
  orders: number;
}

// Notifications
export interface Notification {
  id: string;
  user_id: string;
  user_name?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  sent_at: string;
}

export interface SendNotificationPayload {
  user_id: string;
  title: string;
  body: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Filter types
export interface OrderFilters {
  status?: OrderStatus;
  courier_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ReportFilters {
  start_date: string;
  end_date: string;
}

export interface ReportSummary {
  total_orders: number;
  total_revenue: number;
  average_orders_per_day: number;
  top_courier?: {
    id: string;
    name: string;
    orders_count: number;
    earnings: number;
  };
  orders_by_status: {
    status: OrderStatus;
    count: number;
  }[];
}
