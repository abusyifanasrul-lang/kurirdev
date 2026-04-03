import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useUserStore } from '@/stores/useUserStore';
import { getCustomerSyncTime, getProfileSyncTime } from '@/lib/orderCache';
import { AppListeners } from '@/components/AppListeners';
// NOTE: fcm.ts is NOT statically imported — it's dynamically imported only for courier role
// to avoid pulling firebase/messaging (~30KB) into the main bundle for all users.
import type { UserRole } from '@/types';

// Loading Skeleton
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" role="status" aria-label="Memuat halaman">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin shadow-sm" />
        <p className="text-sm text-gray-600 font-medium">Memuat...</p>
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

// Finance Pages
const FinanceDashboard = lazy(() => import('@/pages/finance/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })));
const FinancePenagihan = lazy(() => import('@/pages/finance/FinancePenagihan').then(m => ({ default: m.FinancePenagihan })));
const FinanceAnalisa = lazy(() => import('@/pages/finance/FinanceAnalisa').then(m => ({ default: m.FinanceAnalisa })));

// Owner Pages
const OwnerOverview = lazy(() => import('@/pages/owner/OwnerOverview').then(m => ({ default: m.OwnerOverview })));

// Super Admin Only
const SystemDiagnostics = lazy(() => import('@/pages/admin/SystemDiagnostics').then(m => ({ default: m.SystemDiagnostics })));

// Courier Pages
const CourierLayout = lazy(() => import('@/pages/courier/CourierLayout').then(m => ({ default: m.CourierLayout })));
const CourierDashboard = lazy(() => import('@/pages/courier/CourierDashboard').then(m => ({ default: m.CourierDashboard })));
const CourierOrders = lazy(() => import('@/pages/courier/CourierOrders').then(m => ({ default: m.CourierOrders })));
const CourierOrderDetail = lazy(() => import('@/pages/courier/CourierOrderDetail').then(m => ({ default: m.CourierOrderDetail })));
const CourierHistory = lazy(() => import('@/pages/courier/CourierHistory').then(m => ({ default: m.CourierHistory })));
const CourierEarnings = lazy(() => import('@/pages/courier/CourierEarnings').then(m => ({ default: m.CourierEarnings })));
const CourierProfile = lazy(() => import('@/pages/courier/CourierProfile').then(m => ({ default: m.CourierProfile })));
const CourierNotifications = lazy(() => import('@/pages/courier/CourierNotifications').then(m => ({ default: m.CourierNotifications })));

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
        (o) => o.status === 'picked_up' || o.status === 'in_transit'
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
    } right-4 bg-white p-4 rounded-xl border border-gray-100 shadow-2xl ring-1 ring-black/5 z-50 animate-in slide-in-from-bottom-5 fade-in w-72`}>
      <div className="flex gap-3 mb-3">
        <div className="bg-teal-50 p-2 rounded-lg text-teal-600 h-10 w-10 flex items-center justify-center shrink-0 shadow-sm">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm">Update Tersedia</h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">Versi baru siap digunakan. Tap update sekarang.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleUpdate} className="flex-[2] bg-teal-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-teal-700 transition shadow-sm active:scale-95">Update Sekarang</button>
        <button onClick={handleDismiss} className="flex-1 bg-gray-50 text-gray-500 text-xs font-medium py-2.5 rounded-lg hover:bg-gray-100 transition active:scale-95">Batal</button>
      </div>
    </div>
  );
}

import { ErrorBoundary } from '@/components/ErrorBoundary';

export function App() {
  const loadFromLocal = useCustomerStore(s => s.loadFromLocal);
  const syncFromServer = useCustomerStore(s => s.syncFromServer);
  const loadUsersFromLocal = useUserStore(s => s.loadFromLocal);
  const syncUsersFromServer = useUserStore(s => s.syncFromServer);

  useEffect(() => {
    // Defer non-critical customer sync — runs after current event loop
    const syncTimer = setTimeout(() => {
      // Customer sync
      loadFromLocal().then(() => {
        const lastSyncRaw = getCustomerSyncTime();
        const lastSyncDate = lastSyncRaw ? new Date(lastSyncRaw).toDateString() : null;
        const today = new Date().toDateString();
        if (lastSyncDate !== today) {
          syncFromServer();
        }
      });

      // User Profile sync
      loadUsersFromLocal().then(() => {
        const lastSyncRaw = getProfileSyncTime();
        const lastSyncDate = lastSyncRaw ? new Date(lastSyncRaw).toDateString() : null;
        const today = new Date().toDateString();
        if (lastSyncDate !== today) {
          syncUsersFromServer();
        }
      });
    }, 0);

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
      clearTimeout(syncTimer);
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
          <AppListeners />
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
                    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                      <AdminLayout />
                    </ProtectedRoute>
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
