import { lazy, Suspense, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useOrderStore } from '@/stores/useOrderStore';
// Removed useCustomerStore, useUserStore, and sync sync helpers as they are moved to AppListeners
import { AppListeners } from '@/components/AppListeners';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
// NOTE: fcm.ts is NOT statically imported — it's dynamically imported only for courier role
// to avoid pulling firebase/messaging (~30KB) into the main bundle for all users.
import type { UserRole } from '@/types';

// Loading Skeleton
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" role="status" aria-label="Memuat halaman">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin shadow-sm" />
        <p className="text-sm text-gray-600 font-medium">Memuat KurirDev...</p>
      </div>
    </div>
  );
}

// Helper for lazy loading with retry on chunk error
function fetchWithRetry(componentImport: () => Promise<any>): Promise<any> {
    return componentImport().catch((error) => {
        // Only retry once per session to avoid infinite reload loops
        const hasRetried = window.sessionStorage.getItem('chunk_load_retried');
        const isChunkError = 
            error.message?.includes('Failed to fetch dynamically imported module') ||
            error.message?.includes('Failed to load module script') ||
            error.message?.includes('Expected a JavaScript-or-Wasm module script');

        if (isChunkError && !hasRetried) {
            window.sessionStorage.setItem('chunk_load_retried', 'true');
            window.location.reload();
            return new Promise(() => {}); // Wait for reload
        }
        throw error;
    });
}

// Lazy-loaded Pages
const Login = lazy(() => fetchWithRetry(() => import('@/pages/Login').then(m => ({ default: m.Login }))));

// Admin Pages
const AdminLayout = lazy(() => fetchWithRetry(() => import('@/components/layout/Layout').then(m => ({ default: m.Layout }))));
const Dashboard = lazy(() => fetchWithRetry(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard }))));
const Orders = lazy(() => fetchWithRetry(() => import('@/pages/Orders').then(m => ({ default: m.Orders }))));
const Couriers = lazy(() => fetchWithRetry(() => import('@/pages/Couriers').then(m => ({ default: m.Couriers }))));
const Reports = lazy(() => fetchWithRetry(() => import('@/pages/Reports').then(m => ({ default: m.Reports }))));
const Notifications = lazy(() => fetchWithRetry(() => import('@/pages/Notifications').then(m => ({ default: m.Notifications }))));
const Settings = lazy(() => fetchWithRetry(() => import('@/pages/Settings').then(m => ({ default: m.Settings }))));

// Finance Pages
const FinanceDashboard = lazy(() => fetchWithRetry(() => import('@/pages/finance/FinanceDashboard').then(m => ({ default: m.FinanceDashboard }))));
const FinancePenagihan = lazy(() => fetchWithRetry(() => import('@/pages/finance/FinancePenagihan').then(m => ({ default: m.FinancePenagihan }))));
const FinanceAnalisa = lazy(() => fetchWithRetry(() => import('@/pages/finance/FinanceAnalisa').then(m => ({ default: m.FinanceAnalisa }))));

// Owner Pages
const OwnerOverview = lazy(() => fetchWithRetry(() => import('@/pages/owner/OwnerOverview').then(m => ({ default: m.OwnerOverview }))));

// Super Admin Only
const SystemDiagnostics = lazy(() => fetchWithRetry(() => import('@/pages/admin/SystemDiagnostics').then(m => ({ default: m.SystemDiagnostics }))));

// Courier Pages
const CourierLayout = lazy(() => fetchWithRetry(() => import('@/pages/courier/CourierLayout').then(m => ({ default: m.CourierLayout }))));
const CourierDashboard = lazy(() => fetchWithRetry(() => import('@/pages/courier/CourierDashboard').then(m => ({ default: m.CourierDashboard }))));
const CourierOrders = lazy(() => fetchWithRetry(() => import('@/pages/courier/CourierOrders').then(m => ({ default: m.CourierOrders }))));
const CourierOrderDetail = lazy(() => fetchWithRetry(() => import('@/pages/courier/CourierOrderDetail').then(m => ({ default: m.CourierOrderDetail }))));
const CourierHistory = lazy(() => fetchWithRetry(() => import('@/pages/courier/CourierHistory').then(m => ({ default: m.CourierHistory }))));
const CourierEarnings = lazy(() => fetchWithRetry(() => import('@/pages/courier/CourierEarnings').then(m => ({ default: m.CourierEarnings }))));
const CourierProfile = lazy(() => fetchWithRetry(() => import('@/pages/courier/CourierProfile').then(m => ({ default: m.CourierProfile }))));
const CourierNotifications = lazy(() => fetchWithRetry(() => import('@/pages/courier/CourierNotifications').then(m => ({ default: m.CourierNotifications }))));

// All admin sub-roles
const ADMIN_ROLES: UserRole[] = ['admin', 'admin_kurir', 'owner', 'finance'];

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: UserRole[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  // Strict role check — no more legacy bypass
  const hasAccess = allowedRoles.includes(user.role);
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Auth Check - Redirect to appropriate dashboard if logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (isAuthenticated && user) {
    // Redirect based on role
    if (user.role === 'courier') return <Navigate to="/courier" replace />;
    if (user.role === 'finance') return <Navigate to="/admin/finance" replace />;
    if (user.role === 'owner') return <Navigate to="/admin/overview" replace />;
    // admin_kurir, admin
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}

// PWA Update Banner Component
function PWAUpdateBanner() {
  const { user, isAuthenticated } = useAuth();
  const { orders, activeOrdersByCourier } = useOrderStore();
  const [showBanner, setShowBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(reg => {
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

      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
      }
    }).catch(err => console.error("SW ready Check failed:", err));
  }, []);

  useEffect(() => {
    if (!waitingWorker) return;

    const dismissedAt = localStorage.getItem('pwa_update_dismissed');
    if (dismissedAt) {
      const hoursAgo = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60);
      if (hoursAgo < 6) return;
    }

    if (isAuthenticated && user?.role === 'courier') {
      const activeOrders = activeOrdersByCourier.filter(
        (o: any) => o.status === 'picked_up' || o.status === 'in_transit'
      );
      if (activeOrders.length > 0) {
        return;
      }
    }

    setShowBanner(true);
  }, [waitingWorker, isAuthenticated, user, orders]);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowBanner(false);
    localStorage.removeItem('pwa_update_dismissed');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_update_dismissed', String(Date.now()));
  };

  if (!showBanner) return null;

  return (
    <div className={`fixed ${
      isAuthenticated && user?.role === 'courier'
        ? 'bottom-24'
        : 'bottom-4'
    } left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border-l-4 border-emerald-600 rounded-lg shadow-xl p-4 z-50 animate-in fade-in slide-in-from-bottom-4`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
          <RefreshCw className="w-5 h-5 animate-spin-slow" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Pembaruan Tersedia</h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Versi terbaru KurirDev sudah siap. Silakan muat ulang untuk fitur baru.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleUpdate}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700 transition-colors shadow-sm focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Update Sekarang
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700 transition-colors"
            >
              Nanti saja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/ui/ToastContainer';
export function App() {
  useEffect(() => {
    // Note: Customer and Profile sync is now handled by AppListeners
    
    const currentUserStr = sessionStorage.getItem('user-session');
    let fcmRefreshInterval: ReturnType<typeof setInterval> | null = null;
    let unsubFCM: any;

    if (currentUserStr) {
      try {
        const sessionData = JSON.parse(currentUserStr);
        const currentUser = sessionData.state?.user;
        if (currentUser?.role === 'courier') {
          // Dynamic import — only loads firebase/messaging for courier role
          import('@/lib/fcm').then(({ refreshFCMToken, onForegroundMessage }) => {
            refreshFCMToken(currentUser.id).catch(console.error);
            const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
            fcmRefreshInterval = setInterval(() => {
              refreshFCMToken(currentUser.id).catch(console.error);
            }, SEVEN_DAYS_MS);
            unsubFCM = onForegroundMessage((payload: any) => {
              console.log('🔔 Foreground message received:', payload);
              const notifData = payload.notification || payload.data || {};
              const title = notifData.title;
              const body = notifData.body;
              if (title && Notification.permission === 'granted') {
                const notif = new Notification(title, {
                  body: body || '',
                  icon: '/icons/android/android-launchericon-192-192.png',
                  tag: payload.data?.orderId || 'kurirdev-foreground',
                });
                notif.onclick = () => window.focus();
              }
            });
          }).catch(err => console.error('FCM dynamic import failed:', err));
        }
      } catch (e) {
        // ignore parse error
      }
    }

    return () => {
      // clearTimeout(syncTimer); // Removed: sync logic moved to AppListeners
      if (unsubFCM) {
        if (typeof unsubFCM === 'function') {
          unsubFCM();
        } else if (unsubFCM.then) {
          unsubFCM.then((h: any) => h.remove?.());
        }
      }
      if (fcmRefreshInterval) clearInterval(fcmRefreshInterval);
    };
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <OfflineBanner />
          <AppListeners />
          <ToastContainer />
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

                {/* Admin Routes - accessible by all admin sub-roles */}
                <Route
                  path="/admin"
                  element={
                    <ErrorBoundary>
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <AdminLayout />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  }
                >
                  {/* Dashboard - Admin Kurir focused */}
                  <Route path="dashboard" element={<Dashboard />} />

                  {/* Owner Overview */}
                  <Route 
                    path="overview" 
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin']}>
                        <OwnerOverview />
                      </ProtectedRoute>
                    } 
                  />

                  {/* Orders - Admin Kurir full, others read-only */}
                  <Route path="orders" element={<Orders />} />

                  {/* Couriers */}
                  <Route path="couriers" element={<Couriers />} />

                  {/* Reports - Owner & Finance */}
                  <Route 
                    path="reports" 
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'finance', 'admin']}>
                        <Reports />
                      </ProtectedRoute>
                    } 
                  />

                  {/* Notifications - Admin Kurir only */}
                  <Route 
                    path="notifications" 
                    element={
                      <ProtectedRoute allowedRoles={['admin_kurir', 'admin']}>
                        <Notifications />
                      </ProtectedRoute>
                    } 
                  />

                  {/* Finance Routes */}
                  <Route 
                    path="finance" 
                    element={
                      <ProtectedRoute allowedRoles={['finance', 'owner', 'admin']}>
                        <FinanceDashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="finance/penagihan" 
                    element={
                      <ProtectedRoute allowedRoles={['finance', 'owner', 'admin']}>
                        <FinancePenagihan />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="finance/analisa" 
                    element={
                      <ProtectedRoute allowedRoles={['finance', 'owner', 'admin']}>
                        <FinanceAnalisa />
                      </ProtectedRoute>
                    } 
                  />

                  <Route 
                    path="settings" 
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'owner', 'admin_kurir', 'finance']}>
                        <Settings />
                      </ProtectedRoute>
                    } 
                  />

                  {/* Diagnostics - Super Admin ONLY (God View) */}
                  <Route 
                    path="diagnostics" 
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <SystemDiagnostics />
                      </ProtectedRoute>
                    } 
                  />

                  {/* Default redirect for /admin */}
                  <Route index element={<AdminRedirect />} />
                </Route>

                {/* Courier PWA Routes */}
                <Route
                  path="/courier"
                  element={
                    <ErrorBoundary>
                      <ProtectedRoute allowedRoles={['courier']}>
                        <CourierLayout />
                      </ProtectedRoute>
                    </ErrorBoundary>
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
    </ErrorBoundary>
  );
}

// Redirect /admin to the appropriate dashboard based on role
function AdminRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;

  switch (user.role) {
    case 'finance':
      return <Navigate to="/admin/finance" replace />;
    case 'owner':
      return <Navigate to="/admin/overview" replace />;
    default:
      return <Navigate to="/admin/dashboard" replace />;
  }
}
