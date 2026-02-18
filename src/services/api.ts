import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Order,
  OrderStatusHistory,
  CreateOrderPayload,
  Courier,
  CourierPerformance,
  DashboardAnalytics,
  RevenueChartData,
  Notification,
  SendNotificationPayload,
  ApiResponse,
  PaginatedResponse,
  OrderFilters,
  ReportFilters,
  ReportSummary,
} from '@/types';

// API base URL - in production, this should be set in environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://n8n.kurirdev.my.id/api';

if (import.meta.env.DEV) {
  console.log('KurirDev API Base:', API_BASE_URL);
}

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  logout: async (): Promise<ApiResponse<null>> => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<ApiResponse<null>> => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },
};

// Orders API
export const ordersApi = {
  getOrders: async (filters?: OrderFilters): Promise<ApiResponse<PaginatedResponse<Order>>> => {
    const response = await api.get('/orders', { params: filters });
    return response.data;
  },

  getOrder: async (id: number): Promise<ApiResponse<Order & { status_history: OrderStatusHistory[] }>> => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  createOrder: async (payload: CreateOrderPayload): Promise<ApiResponse<Order>> => {
    const response = await api.post('/orders', payload);
    return response.data;
  },

  assignCourier: async (orderId: number, courierId: number): Promise<ApiResponse<Order>> => {
    const response = await api.put(`/orders/${orderId}/assign`, { courier_id: courierId });
    return response.data;
  },

  cancelOrder: async (orderId: number, reason: string): Promise<ApiResponse<Order>> => {
    const response = await api.put(`/orders/${orderId}/cancel`, { reason });
    return response.data;
  },

  getRecentOrders: async (since?: string): Promise<ApiResponse<Order[]>> => {
    const response = await api.get('/orders/recent', { params: { since } });
    return response.data;
  },

  exportOrders: async (filters?: OrderFilters): Promise<Blob> => {
    const response = await api.get('/orders/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Couriers API
export const couriersApi = {
  getCouriers: async (): Promise<ApiResponse<Courier[]>> => {
    const response = await api.get('/couriers');
    return response.data;
  },

  getCourier: async (id: number): Promise<ApiResponse<Courier>> => {
    const response = await api.get(`/couriers/${id}`);
    return response.data;
  },

  createCourier: async (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<ApiResponse<Courier>> => {
    const response = await api.post('/couriers', payload);
    return response.data;
  },

  updateCourierStatus: async (id: number, isActive: boolean): Promise<ApiResponse<Courier>> => {
    const response = await api.put(`/couriers/${id}/status`, { is_active: isActive });
    return response.data;
  },

  getCourierPerformance: async (id: number): Promise<ApiResponse<CourierPerformance>> => {
    const response = await api.get(`/couriers/${id}/performance`);
    return response.data;
  },
};

// Dashboard API
export const dashboardApi = {
  getAnalytics: async (): Promise<ApiResponse<DashboardAnalytics>> => {
    const response = await api.get('/dashboard/analytics');
    return response.data;
  },

  getRevenueChart: async (days?: number): Promise<ApiResponse<RevenueChartData[]>> => {
    const response = await api.get('/dashboard/revenue-chart', { params: { days } });
    return response.data;
  },

  getOrdersChart: async (): Promise<ApiResponse<{ status: string; count: number }[]>> => {
    const response = await api.get('/dashboard/orders-chart');
    return response.data;
  },
};

// Reports API
export const reportsApi = {
  getSummary: async (filters: ReportFilters): Promise<ApiResponse<ReportSummary>> => {
    const response = await api.get('/reports/summary', { params: filters });
    return response.data;
  },

  exportReport: async (filters: ReportFilters): Promise<Blob> => {
    const response = await api.get('/reports/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Notifications API
export const notificationsApi = {
  getNotifications: async (): Promise<ApiResponse<Notification[]>> => {
    const response = await api.get('/notifications');
    return response.data;
  },

  sendNotification: async (payload: SendNotificationPayload): Promise<ApiResponse<Notification>> => {
    const response = await api.post('/notifications/send', payload);
    return response.data;
  },
};

export default api;
