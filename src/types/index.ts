// User types
export type UserRole = 'admin' | 'admin_kurir' | 'owner' | 'finance' | 'courier';

export function isAdminRole(role: UserRole): boolean {
  return ['admin', 'admin_kurir', 'owner', 'finance'].includes(role);
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Super Admin',
    admin_kurir: 'Admin Kurir',
    owner: 'Owner',
    finance: 'Keuangan',
    courier: 'Kurir',
  };
  return labels[role] || role;
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    admin: 'bg-teal-100 text-teal-700',
    admin_kurir: 'bg-cyan-100 text-cyan-700',
    owner: 'bg-emerald-100 text-emerald-700',
    finance: 'bg-amber-100 text-amber-700',
    courier: 'bg-blue-100 text-blue-700',
  };
  return colors[role] || 'bg-gray-100 text-gray-700';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  is_online?: boolean;
  fcm_token?: string;
  courier_status?: 'on' | 'stay' | 'off';
  off_reason?: string;
  created_at: string;
  updated_at: string;
  vehicle_type?: 'motorcycle' | 'car' | 'bicycle' | 'van';
  plate_number?: string;
  created_by?: string;
  queue_position?: number;
  total_deliveries_alltime?: number;
  total_earnings_alltime?: number;
  unpaid_count?: number;
  unpaid_amount?: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  password?: string;
}

export interface CustomerAddress {
  id: string;
  label: string;
  address: string;
  is_default: boolean;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  addresses: CustomerAddress[];
  created_at: string;
  updated_at: string;
  order_count?: number;
  last_order_at?: string;
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
  customer_id?: string;
  customer_address_id?: string;
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
  is_waiting?: boolean;
  applied_commission_rate?: number;
  applied_commission_threshold?: number;
  cancel_reason_type?: 'customer' | 'item_unavailable' | 'other';
  assigned_by?: string;
  payment_confirmed_by?: string;
  cancelled_by?: string;
  courier?: {
    name: string;
    vehicle_type?: 'motorcycle' | 'car' | 'bicycle' | 'van';
    plate_number?: string;
  };
  assigner?: {
    name: string;
  };
  assigner_name?: string;
  courier_name?: string;
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
  customer_id?: string;
  customer_address_id?: string;
  total_fee?: number;
  payment_status?: PaymentStatus;
  estimated_delivery_time?: string;
  items?: { nama: string; harga: number }[];
  notes?: string;
}

// Courier types
export interface Courier extends User {
  vehicle_type?: 'motorcycle' | 'car' | 'bicycle' | 'van';
  plate_number?: string;
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
  message: string;
  type?: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  sent_at: string;
  fcm_status?: 'pending' | 'sent' | 'failed' | 'skipped';
  fcm_error?: string;
  idempotency_key?: string;
}

export interface SendNotificationPayload {
  user_id: string;
  title: string;
  message: string;
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

export interface CourierInstruction {
  id: string;
  label: string;
  instruction: string;
  icon: string;
}

export interface CustomerChangeRequest {
  id: string;
  customer_id: string;
  customer_name: string;
  requester_id: string;
  requester_name: string;
  old_data: Partial<Customer>;
  requested_data: Partial<Customer>;
  order_id?: string;
  order_number?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_id?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  change_type?: 'address_add' | 'address_edit' | 'address_delete' | 'full_update';
  affected_address_id?: string;
  new_address?: CustomerAddress;
}
