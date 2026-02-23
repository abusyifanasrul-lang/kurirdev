import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';

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
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  // Strictly respect the store state
  if (!isAuthenticated || !user) {
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
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/courier'} replace />;
  }

  return <>{children}</>;
}

// PWA Update Banner Component
function PWAUpdateBanner() {
  const { user, isAuthenticated } = useAuth();
  const { orders } = useOrderStore();
  const [showBanner, setShowBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
            }
          });
        }
      });
    }).catch(err => console.error("SW Registration failed:", err));
  }, []);

  useEffect(() => {
    if (!waitingWorker) return;

    // Strict condition: Check if courier is actively processing an order
    if (isAuthenticated && user?.role === 'courier') {
      const activeOrders = orders.filter(
        (o) => o.courier_id === user.id && (o.status === 'picked_up' || o.status === 'in_transit')
      );
      if (activeOrders.length > 0) {
        return; // Suppress banner to prevent disrupting active operations
      }
    }

    setShowBanner(true);
  }, [waitingWorker, isAuthenticated, user, orders]);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowBanner(false);
    setTimeout(() => {
      window.location.reload();
    }, 500); // Give SW short breathing room to swap
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xl z-50 animate-in slide-in-from-bottom-5 fade-in w-72">
      <div className="flex gap-3 mb-3">
        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 h-9 w-9 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">Versi Baru Tersedia</h4>
          <p className="text-xs text-gray-500 mt-1">Tap update agar aplikasi tersinkronisasi.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleUpdate} className="flex-1 bg-indigo-600 text-white text-xs font-medium py-2 rounded-lg hover:bg-indigo-700 transition">Update</button>
        <button onClick={handleDismiss} className="flex-1 bg-gray-100 text-gray-700 text-xs font-medium py-2 rounded-lg hover:bg-gray-200 transition">Nanti</button>
      </div>
    </div>
  );
}

export function App() {
  const subscribeUsers = useUserStore(state => state.subscribeUsers)

  useEffect(() => {
    const unsub = subscribeUsers()
    return () => unsub()
  }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <PWAUpdateBanner />
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
    </ThemeProvider>
  );
}
