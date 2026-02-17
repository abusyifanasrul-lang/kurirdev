import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';

// Pages
import { Login } from '@/pages/Login';

// Admin Layout & Pages
import { Layout as AdminLayout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Orders } from '@/pages/Orders';
import { Couriers } from '@/pages/Couriers';
import { Reports } from '@/pages/Reports';
import { Notifications } from '@/pages/Notifications';
import { Settings } from '@/pages/Settings';

// Courier Layout & Pages
import { CourierLayout } from '@/pages/courier/CourierLayout';
import { CourierDashboard } from '@/pages/courier/CourierDashboard';
import { CourierOrders } from '@/pages/courier/CourierOrders';
import { CourierOrderDetail } from '@/pages/courier/CourierOrderDetail';
import { CourierHistory } from '@/pages/courier/CourierHistory';
import { CourierEarnings } from '@/pages/courier/CourierEarnings';
import { CourierProfile } from '@/pages/courier/CourierProfile';
import { CourierNotifications } from '@/pages/courier/CourierNotifications';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const token = localStorage.getItem('auth_token');
  const userRole = localStorage.getItem('user_role');

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (userRole && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard
    if (userRole === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (userRole === 'courier') {
      return <Navigate to="/courier" replace />;
    }
  }

  return <>{children}</>;
}

// Auth Check - Redirect if already logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token');
  const userRole = localStorage.getItem('user_role');

  if (token && userRole) {
    if (userRole === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (userRole === 'courier') {
      return <Navigate to="/courier" replace />;
    }
  }

  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}
