import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { useSessionStore } from './stores/useSessionStore';

// Loading Skeleton
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" role="status" aria-label="Memuat halaman">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Memuat...</p>
      </div>
    </div>
  );
}

// Lazy-loaded Pages
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));

// Admin Pages
const AdminLayout = lazy(() => import('@/components/layout/Layout').then(m => ({ default: m.Layout })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Orders = lazy(() => import('@/pages/Orders').then(m => ({ default: m.Orders })));
const Couriers = lazy(() => import('@/pages/Couriers').then(m => ({ default: m.Couriers })));
const Reports = lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })));
const Notifications = lazy(() => import('@/pages/Notifications').then(m => ({ default: m.Notifications })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));

// Courier Pages
const CourierLayout = lazy(() => import('@/pages/courier/CourierLayout').then(m => ({ default: m.CourierLayout })));
const CourierDashboard = lazy(() => import('@/pages/courier/CourierDashboard').then(m => ({ default: m.CourierDashboard })));
const CourierOrders = lazy(() => import('@/pages/courier/CourierOrders').then(m => ({ default: m.CourierOrders })));
const CourierOrderDetail = lazy(() => import('@/pages/courier/CourierOrderDetail').then(m => ({ default: m.CourierOrderDetail })));
const CourierHistory = lazy(() => import('@/pages/courier/CourierHistory').then(m => ({ default: m.CourierHistory })));
const CourierEarnings = lazy(() => import('@/pages/courier/CourierEarnings').then(m => ({ default: m.CourierEarnings })));
const CourierProfile = lazy(() => import('@/pages/courier/CourierProfile').then(m => ({ default: m.CourierProfile })));
const CourierNotifications = lazy(() => import('@/pages/courier/CourierNotifications').then(m => ({ default: m.CourierNotifications })));

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated } = useSessionStore();
  const token = sessionStorage.getItem('auth_token');

  // Strictly respect the token and store state
  if (!token || !isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  // Strictly check roles but stay on current page if unauthorized (or simple redirect to root)
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Auth Check - Redirect to dashboard if logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useSessionStore();
  const token = sessionStorage.getItem('auth_token');

  if (token && isAuthenticated && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/courier'} replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Login Page */}
            <Route
              path="/"
              element={
                <AuthRoute>
                  <Login />
                </AuthRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="couriers" element={<Couriers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Courier PWA Routes */}
            <Route
              path="/courier"
              element={
                <ProtectedRoute allowedRoles={['courier']}>
                  <CourierLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CourierDashboard />} />
              <Route path="orders" element={<CourierOrders />} />
              <Route path="orders/:id" element={<CourierOrderDetail />} />
              <Route path="notifications" element={<CourierNotifications />} />
              <Route path="history" element={<CourierHistory />} />
              <Route path="earnings" element={<CourierEarnings />} />
              <Route path="profile" element={<CourierProfile />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
