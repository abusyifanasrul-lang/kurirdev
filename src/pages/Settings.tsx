import { useState, useEffect } from 'react';
import { User, Lock, Users, Shield, Settings as SettingsIcon, Database } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/context/AuthContext';
import { useCourierStore } from '@/stores/useCourierStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  clearAllCache,
  getCacheMeta,
  getOrphanedOrdersLocal,
} from '@/lib/orderCache';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

// Sub-components
import { lazy, Suspense } from 'react';

// Lazy-loaded Sub-components
const ProfileTab = lazy(() => import('@/components/settings/ProfileTab').then(m => ({ default: m.ProfileTab })));
const PasswordTab = lazy(() => import('@/components/settings/PasswordTab').then(m => ({ default: m.PasswordTab })));
const UsersTab = lazy(() => import('@/components/settings/UsersTab').then(m => ({ default: m.UsersTab })));
const GeneralOpsTab = lazy(() => import('@/components/settings/GeneralOpsTab').then(m => ({ default: m.GeneralOpsTab })));
const InstructionsTab = lazy(() => import('@/components/settings/InstructionsTab').then(m => ({ default: m.InstructionsTab })));
const StorageTab = lazy(() => import('@/components/settings/StorageTab').then(m => ({ default: m.StorageTab })));
const BusinessTab = lazy(() => import('@/components/settings/BusinessTab').then(m => ({ default: m.BusinessTab })));

function TabLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-500">
      <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-3" />
      <p className="text-xs text-gray-400 font-medium">Memuat pengaturan...</p>
    </div>
  );
}



const ALL_CATEGORIES = [
  { id: 'account', label: 'Akun', icon: User },
  { id: 'ops', label: 'Operasional', icon: SettingsIcon },
  { id: 'finance', label: 'Keuangan', icon: Shield },
  { id: 'system', label: 'Sistem', icon: Database },
] as const;

const ALL_TABS = [
  { id: 'profile', label: 'Profil Saya', icon: User, category: 'account' },
  { id: 'password', label: 'Keamanan', icon: Lock, category: 'account' },
  { id: 'users', label: 'User Sistem', icon: Users, category: 'ops' },
  { id: 'general_ops', label: 'Umum (Operasional)', icon: SettingsIcon, category: 'ops' },
  { id: 'instructions', label: 'Instruksi Kurir', icon: SettingsIcon, category: 'ops' },
  { id: 'business', label: 'Komisi & Biaya', icon: Shield, category: 'finance' },
  { id: 'storage', label: 'Penyimpanan', icon: Database, category: 'system' },
] as const;

export function Settings() {
  const { users, updateUser, addUser } = useUserStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { updateCourier } = useCourierStore();
  const { 
    commission_rate, 
    commission_threshold, 
    operational_area,
    operational_timezone,
    courier_instructions,
    updateSettings,
    addCourierInstruction,
    updateCourierInstruction,
    deleteCourierInstruction 
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<typeof ALL_TABS[number]['id']>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingPush, setIsRefreshingPush] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cache/Sync State
  const [cacheMeta, setCacheMeta] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // ── Modal State ──────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info' | 'primary';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'primary',
    onConfirm: () => {},
  });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    variant: 'danger' | 'warning' | 'info' | 'primary' = 'primary'
  ) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, variant });
  };

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    setCacheMeta(getCacheMeta());
  }, []);

  const syncSettingsToServer = async () => {
    try {
      const state = useSettingsStore.getState();
      const { error } = await (supabase
        .from('settings') as any)
        .update({
          commission_rate: state.commission_rate,
          commission_threshold: state.commission_threshold,
          operational_area: state.operational_area,
          operational_timezone: state.operational_timezone,
          courier_instructions: state.courier_instructions,
        } as any)
        .eq('id', 'global');
        
      if (error) throw error;
    } catch (err) {
      console.error('Failed to sync settings to Supabase:', err);
    }
  };

  const handleUpdateProfile = async (data: any) => {
    if (!user) return;
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 500));
    updateUser(user.id, data);
    showMessage('success', 'Profil berhasil diperbarui!');
    setIsLoading(false);
  };

  const handleRefreshPush = async () => {
    if (!user) return;
    setIsRefreshingPush(true);
    try {
      const { requestFCMPermission } = await import('@/lib/fcm');
      const token = await requestFCMPermission(user.id);
      if (token) {
        showMessage('success', 'Notifikasi berhasil diaktifkan kembali!');
      } else {
        showMessage('error', 'Gagal mengaktifkan notifikasi.');
      }
    } catch (err) {
      showMessage('error', 'Terjadi kesalahan sistem saat refresh push.');
    } finally {
      setIsRefreshingPush(false);
    }
  };

  const handleChangePassword = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) {
      showMessage('error', 'Password tidak cocok!');
      return;
    }
    if (data.newPassword.length < 8) {
      showMessage('error', 'Password minimal 8 karakter!');
      return;
    }
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    showMessage('success', 'Password berhasil diubah!');
    setIsLoading(false);
  };

  const handleSaveBusinessSettings = async (data: any) => {
    updateSettings(data);
    await syncSettingsToServer();
    showMessage('success', 'Pengaturan bisnis berhasil disimpan!');
  };

  const handleResync = async () => {
    if (isSyncing) return;

    showConfirm(
      'Reset & Sinkronisasi Ulang',
      "⚠️ PERINGATAN KRITIS\n\nTindakan ini akan:\n1. Menghapus database lokal (IndexedDB).\n2. Logout otomatis.\n3. Mengunduh ulang data pada login berikutnya.\n\nGunakan hanya jika terjadi masalah sinkronisasi parah.",
      async () => {
        setIsSyncing(true);
        setSyncMessage('Menghapus cache lokal...');
        try {
          await clearAllCache();
          setSyncMessage('Cache dihapus. Logout...');
          setTimeout(async () => {
            await logout();
            navigate('/');
          }, 1000);
        } catch (error) {
          setSyncMessage('Gagal mereset cache.');
          setIsSyncing(false);
        }
        closeConfirm();
      },
      'danger'
    );
  };

  const tabs = ALL_TABS.filter((tab) => {
    if (tab.id === 'users') {
      return user?.role === 'admin' || user?.role === 'owner' || user?.role === 'admin_kurir';
    }
    if (tab.id === 'business') {
      return user?.role === 'admin' || user?.role === 'owner';
    }
    if (tab.id === 'instructions') {
      return user?.role === 'admin' || user?.role === 'owner';
    }
    if (tab.id === 'general_ops') {
      return user?.role !== 'finance';
    }
    return true;
  });


  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <Header title="Pengaturan" />
      
      <div className="max-w-[1600px] mx-auto p-4 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <nav className="space-y-8 sticky top-24">
              {ALL_CATEGORIES.map(cat => {
                const categoryTabs = tabs.filter(t => t.category === cat.id);
                if (categoryTabs.length === 0) return null;
                
                return (
                  <div key={cat.id}>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                      <cat.icon className="h-3 w-3" />
                      {cat.label}
                    </h4>
                    <div className="space-y-1">
                      {categoryTabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                            activeTab === tab.id 
                              ? 'bg-teal-50 text-teal-700 shadow-sm border border-teal-100' 
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
                          }`}
                        >
                          <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-teal-600' : 'text-gray-400'}`} />
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

            </nav>
          </aside>

          {/* Mobile Categories - Horizontal Scroll or Grid */}
          <div className="lg:hidden">
            {/* Horizontal Tabs for Mobile */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-px scrollbar-hide -mx-4 px-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-all whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md scale-105' 
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {/* Global Feedback */}
            {message && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 border animate-in slide-in-from-top duration-300 ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
              }`}>
                <span>{message.text}</span>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
              <div className="p-6 lg:p-8">
                <Suspense fallback={<TabLoading />}>
                  {activeTab === 'profile' && (
                    <ProfileTab 
                      user={user} 
                      onUpdate={handleUpdateProfile} 
                      onRefreshPush={handleRefreshPush}
                      isLoading={isLoading}
                      isRefreshingPush={isRefreshingPush}
                    />
                  )}

                  {activeTab === 'password' && (
                    <PasswordTab 
                      onUpdate={handleChangePassword} 
                      isLoading={isLoading} 
                    />
                  )}

                  {activeTab === 'users' && (
                    <UsersTab 
                      currentUser={user}
                      users={users}
                      onAddUser={async (data: any) => {
                        return await addUser(data);
                      }}
                      onUpdateUser={updateUser}
                      onToggleSuspend={(u) => updateCourier(u.id, { is_active: !u.is_active })}
                    />
                  )}

                  {activeTab === 'business' && (
                    <BusinessTab 
                      commission_rate={commission_rate}
                      commission_threshold={commission_threshold}
                      onSaveSettings={handleSaveBusinessSettings}
                      onResync={handleResync}
                      cacheMeta={cacheMeta}
                      isSyncing={isSyncing}
                      syncMessage={syncMessage}
                      user={user}
                      users={users}
                      getOrphanedOrdersLocal={getOrphanedOrdersLocal}
                    />
                  )}

                  {activeTab === 'general_ops' && (
                    <GeneralOpsTab 
                      operational_area={operational_area}
                      operational_timezone={operational_timezone}
                      onSaveSettings={handleSaveBusinessSettings}
                    />
                  )}

                  {activeTab === 'instructions' && (
                    <InstructionsTab 
                      instructions={courier_instructions || []}
                      onAdd={async (data) => { await addCourierInstruction(data); }}
                      onUpdate={async (id, data) => { await updateCourierInstruction(id, data); }}
                      onDelete={async (id) => { await deleteCourierInstruction(id); }}
                    />
                  )}

                  {activeTab === 'storage' && (
                    <StorageTab 
                      onResync={handleResync}
                      isSyncing={isSyncing}
                      syncMessage={syncMessage}
                      cacheMeta={cacheMeta}
                      user={user}
                      users={users}
                      getOrphanedOrdersLocal={getOrphanedOrdersLocal}
                    />
                  )}
                </Suspense>
              </div>
            </div>
          </main>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
}
