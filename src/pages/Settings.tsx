import { useState, useEffect } from 'react';
import { User, Lock, Users, Plus, CheckCircle, AlertCircle, Shield, Edit2, UserX, RefreshCw, Eye, EyeOff, Settings as SettingsIcon, Trash2, Edit3 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import type { User as UserType } from '@/types';
import type { CourierInstruction } from '@/stores/useSettingsStore';

// Store
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/context/AuthContext';
import { useCourierStore } from '@/stores/useCourierStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  clearAllCache,
  getCacheMeta,
} from '@/lib/orderCache';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { users, updateUser, addUser } = useUserStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { updateCourier } = useCourierStore();
  const { 
    commission_rate, 
    commission_threshold, 
    courier_instructions,
    updateSettings,
    addCourierInstruction,
    updateCourierInstruction,
    deleteCourierInstruction 
  } = useSettingsStore()
  const [businessForm, setBusinessForm] = useState({
    commission_rate,
    commission_threshold,
  })
  const handleSaveBusinessSettings = () => {
    if (
      isNaN(businessForm.commission_rate) ||
      businessForm.commission_rate < 0 ||
      businessForm.commission_rate > 100
    ) {
      showMessage('error', 'Commission rate harus antara 0 dan 100.')
      return
    }
    if (
      isNaN(businessForm.commission_threshold) ||
      businessForm.commission_threshold < 0
    ) {
      showMessage('error', 'Threshold tidak boleh bernilai negatif.')
      return
    }
    updateSettings(businessForm)
    showMessage('success', 'Business settings saved!')
  }

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'users' | 'business' | 'instructions'>('profile');

  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // User management state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<UserType | null>(null);

  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'admin', phone: '' });
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cache sync state
  const [cacheMeta, setCacheMeta] = useState<{
    last_sync: string
    total_records: number
    sync_completed: boolean
    last_delta_sync: string
  } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  // Helper to show msg
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Load cache metadata on mount
  useEffect(() => {
    setCacheMeta(getCacheMeta())
  }, [])

  // Handle cache resync
  const handleResync = async () => {
    if (isSyncing) return
    const confirmed = window.confirm(
      'Reset dan sinkronisasi ulang semua ' +
      'data lokal dari server? ' +
      'Anda akan logout otomatis.'
    )
    if (!confirmed) return

    setIsSyncing(true)
    setSyncMessage('Menghapus cache lokal...')

    try {
      await clearAllCache()
      setSyncMessage('Cache dihapus. Logout...')
      // Logout dulu agar fresh saat login ulang
      setTimeout(async () => {
        await logout()
        navigate('/')
      }, 1000)
    } catch (error) {
      console.error('Resync error:', error)
      setSyncMessage('Gagal mereset cache.')
      setIsSyncing(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    updateUser(user.id, profileForm);
    showMessage('success', 'Profile updated successfully!');
    setIsLoading(false);
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'Passwords do not match!');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showMessage('error', 'Password must be at least 8 characters!');
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // In real app, verify current password here
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    showMessage('success', 'Password changed successfully!');
    setIsLoading(false);
  };

  const handleAddUser = () => {
    // Normal admin add
    const userData: UserType = {
      id: crypto.randomUUID(),
      name: newUser.name,
      email: newUser.email,
      role: 'admin', // Enforce admin
      phone: newUser.phone,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addUser(userData);

    setIsAddUserModalOpen(false);
    setNewUser({ name: '', email: '', password: '', role: 'admin', phone: '' });
    showMessage('success', 'User added successfully!');
  };

  const openEditModal = (u: UserType) => {
    setSelectedUserToEdit(u);
    setEditUserForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      password: '' // Default empty, only update if filled
    });
    setIsEditUserModalOpen(true);
  };

  const handleSaveEditUser = () => {
    if (!selectedUserToEdit) return;

    const updates: Partial<UserType> & { password?: string } = {
      name: editUserForm.name,
      email: editUserForm.email,
      phone: editUserForm.phone
    };

    if (editUserForm.password) {
      // Logic to update password would technically be separate or handled here
      // For now we just pretend to update it in the User object, 
      // though typically password isn't stored in plain text.
      // The mock store doesn't check password anyway, so this is symbolic.
      updates.password = editUserForm.password;
    }

    updateUser(selectedUserToEdit.id, updates);
    setIsEditUserModalOpen(false);
    setSelectedUserToEdit(null);
    showMessage('success', 'User updated successfully!');
  };

  const handleToggleSuspend = (u: UserType) => {
    if (u.id === user?.id) {
      showMessage('error', 'You cannot suspend yourself!');
      return;
    }
    // RBAC: Only Super Admin (id 1) can change status
    if (user?.id !== "1") {
      showMessage('error', 'Only Super Admin can change user status!');
      return;
    }

    updateCourier(u.id, { is_active: !u.is_active });
    showMessage('success', `User ${!u.is_active ? 'activated' : 'suspended'} successfully!`);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'users', label: 'System Users', icon: Users },
    { id: 'business', label: 'Business', icon: Shield },
    { id: 'instructions', label: 'Instruksi Kurir', icon: SettingsIcon },
  ] as const;

  // Instructions state
  const [isAddInstructionModalOpen, setIsAddInstructionModalOpen] = useState(false);
  const [isEditInstructionModalOpen, setIsEditInstructionModalOpen] = useState(false);
  const [selectedInstructionToEdit, setSelectedInstructionToEdit] = useState<CourierInstruction | null>(null);
  const [newInstruction, setNewInstruction] = useState({ label: '', instruction: '', icon: '✅' });
  const [editInstructionForm, setEditInstructionForm] = useState({ label: '', instruction: '', icon: '✅' });

  // Emoji options untuk emoji picker
  const emojiOptions = ['✅','🔍','🛒','📍','🚚','📦','⏰','⚠️','💬','📞','🧭','📋','🔔','⚡','🎯'];


  // Instructions handlers
  const handleAddInstruction = () => {
    if (!newInstruction.label || !newInstruction.instruction) {
      showMessage('error', 'Label dan instruksi harus diisi!');
      return;
    }
    addCourierInstruction(newInstruction);
    setIsAddInstructionModalOpen(false);
    setNewInstruction({ label: '', instruction: '', icon: '✅' });
    showMessage('success', 'Instruksi berhasil ditambahkan!');
  };

  const openEditInstructionModal = (instruction: CourierInstruction) => {
    setSelectedInstructionToEdit(instruction);
    setEditInstructionForm({
      label: instruction.label,
      instruction: instruction.instruction,
      icon: instruction.icon
    });
    setIsEditInstructionModalOpen(true);
  };

  const handleSaveEditInstruction = () => {
    if (!selectedInstructionToEdit) return;
    
    if (!editInstructionForm.label || !editInstructionForm.instruction) {
      showMessage('error', 'Label dan instruksi harus diisi!');
      return;
    }
    
    updateCourierInstruction(selectedInstructionToEdit.id, editInstructionForm);
    setIsEditInstructionModalOpen(false);
    setSelectedInstructionToEdit(null);
    setEditInstructionForm({ label: '', instruction: '', icon: '✅' });
    showMessage('success', 'Instruksi berhasil diperbarui!');
  };

  const handleDeleteInstruction = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus instruksi ini?')) {
      deleteCourierInstruction(id);
      showMessage('success', 'Instruksi berhasil dihapus!');
    }
  };

  const canEdit = (target: UserType) => {
    if (user?.id === "1") return true // Super Admin bisa edit semua
    if (target.id === "1") return false // Tidak ada yang bisa edit Super Admin kecuali dirinya
    if (target.role === 'admin' && target.id !== user?.id) return false // Admin tidak bisa edit admin lain
    return true
  }

  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage your account and system settings" />

      <div className="p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Message Toast/Banner */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
                }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              {message.text}
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h3>
              <div className="space-y-4 max-w-md">
                <Input
                  label="Full Name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
                <Input
                  label="Phone Number"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+628..."
                />
                <div className="pt-4">
                  <Button onClick={handleUpdateProfile} isLoading={isLoading}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Change Password</h3>
              <div className="space-y-4 max-w-md">
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  helperText="Min 8 characters"
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                />
                <div className="pt-4">
                  <Button
                    onClick={handleChangePassword}
                    isLoading={isLoading}
                    disabled={
                      !passwordForm.currentPassword ||
                      !passwordForm.newPassword ||
                      !passwordForm.confirmPassword
                    }
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <Card>
              <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">System Users</h3>
                  <p className="text-sm text-gray-500">Manage admins and couriers access</p>
                </div>
                {user?.role === 'admin' && (
                  <Button
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setIsAddUserModalOpen(true)}
                  >
                    Add User
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {users.map((u: UserType) => (
                  <div
                    key={u.id}
                    className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-lg gap-4 transition-all ${u.is_active ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-100/50 opacity-60 grayscale-[0.5]'} ${canEdit(u) ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => canEdit(u) && openEditModal(u)}
                  >
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-opacity ${!u.is_active ? 'opacity-50' : ''} ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                        {u.role === 'admin' ? <Shield className="w-5 h-5" /> : u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{u.name}</p>
                          {u.id === user?.id && <Badge variant="info" size="sm">You</Badge>}
                          {!u.is_active && <Badge variant="danger" size="sm" className="bg-red-100 text-red-700 animate-pulse">NON-AKTIF</Badge>}
                        </div>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      <Badge variant={u.role === 'admin' ? 'default' : 'warning'} className="capitalize">
                        {u.role.replace('_', ' ')}
                      </Badge>

                      {/* Edit Button (Visible based on permission) */}
                      {canEdit(u) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(u); }}
                          className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}

                      {/* Status Toggle Action - RBAC Protected */}
                      {user?.id === "1" && u.id !== "1" && u.id !== user.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleSuspend(u); }}
                          className={`p-2 rounded-lg transition-colors ${u.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          title={u.is_active ? "Suspend User" : "Activate User"}
                        >
                          {u.is_active ? <UserX className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Business Tab */}
          {activeTab === 'business' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Business Settings</h3>
              <p className="text-sm text-gray-500 mb-6">Konfigurasi komisi dan threshold ongkir</p>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Rate (%)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Persentase ongkir yang diterima kurir. Sisanya masuk ke admin.
                  </p>
                  <Input
                    type="number"
                    value={businessForm.commission_rate}
                    onChange={e => setBusinessForm(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                    min={0}
                    max={100}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Contoh: 80 → kurir dapat 80%, admin dapat 20%
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Threshold (Rp)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Ongkir di bawah atau sama dengan nilai ini → kurir dapat 100%, admin tidak dapat potongan.
                  </p>
                  <Input
                    type="number"
                    value={businessForm.commission_threshold}
                    onChange={e => setBusinessForm(prev => ({ ...prev, commission_threshold: Number(e.target.value) }))}
                    min={0}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Contoh: 5000 → ongkir ≤ Rp 5.000 tidak dipotong
                  </p>
                </div>
                <div className="pt-4">
                  <p className="text-xs text-gray-500 mb-4">
                    Preview: Ongkir Rp 15.000 → kurir dapat Rp {Math.round(15000 * businessForm.commission_rate / 100).toLocaleString('id-ID')}, admin dapat Rp {Math.round(15000 * (100 - businessForm.commission_rate) / 100).toLocaleString('id-ID')}
                  </p>
                  <Button onClick={handleSaveBusinessSettings}>
                    Simpan Pengaturan
                  </Button>
                </div>

                {/* Super Admin Cleanup Section */}
                {user?.id === "1" && (
                  <div className="pt-6 border-t mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">🔧 Super Admin Tools</h4>
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        Bersihkan order dummy yang tidak lengkap (tanpa ongkir)
                      </p>
                      <button
                        onClick={async () => {
                          const { cleanupDummyOrders } = await import('@/scripts/cleanupOrders')
                          await cleanupDummyOrders()
                          alert('Cleanup selesai!')
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                      >
                        🧹 Cleanup Dummy Orders
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Instructions Tab */}
          {activeTab === 'instructions' && (
            <Card>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Instruksi Kurir</h3>
                  <p className="text-sm text-gray-500 mt-1">Kelola instruksi yang muncul di dropdown order</p>
                </div>
                <Button
                  onClick={() => setIsAddInstructionModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Instruksi
                </Button>
              </div>

              <div className="space-y-3">
                {(courier_instructions ?? []).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <SettingsIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Belum ada instruksi kurir</p>
                    <p className="text-sm">Tambah instruksi untuk memudahkan admin saat assign order</p>
                  </div>
                ) : (
                  (courier_instructions ?? []).map((instruction) => (
                    <div key={instruction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                          <span>{instruction.icon}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{instruction.label}</p>
                          <p className="text-sm text-gray-500">{instruction.instruction}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditInstructionModal(instruction)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteInstruction(instruction.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Add New Admin"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            placeholder="Enter full name"
          />
          <Input
            label="Email Address"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="user@example.com"
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Min 8 chars"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
                      </div>
          <Input
            label="Phone"
            value={newUser.phone}
            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            placeholder="+628..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddUserModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={!newUser.name || !newUser.email || !newUser.password}
            >
              Add User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditUserModalOpen}
        onClose={() => setIsEditUserModalOpen(false)}
        title={`Edit User: ${selectedUserToEdit?.name}`}
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={editUserForm.name}
            onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
          />
          <Input
            label="Email Address"
            type="email"
            value={editUserForm.email}
            onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
          />
          <Input
            label="Phone"
            value={editUserForm.phone}
            onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
          />
          <div className="pt-2 border-t mt-2">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Reset Password</h4>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Leave blank to keep current"
                value={editUserForm.password}
                onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditUserModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditUser}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cache Management Section - Super Admin Only */}
      {user?.id === "1" && (
        <div className="max-w-4xl mx-auto p-4 lg:p-8">
          <div className="bg-gray-50 border
            border-gray-200 rounded-xl p-5">

            <h3 className="font-semibold
              text-gray-900 mb-1 flex
              items-center gap-2">
              🗄️ Data Lokal (Cache)
            </h3>
            <p className="text-xs text-gray-500
              mb-4">
              Data historis tersimpan lokal
              untuk menghemat penggunaan server.
            </p>

            {/* Status Cache */}
            <div className="space-y-2 mb-4
              text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Status
                </span>
                <span className={
                  cacheMeta?.sync_completed
                    ? 'text-green-600 font-medium'
                    : 'text-orange-600 font-medium'
                }>
                  {cacheMeta?.sync_completed
                    ? '✅ Tersinkronisasi'
                    : '⚠️ Belum sinkron'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Total record lokal
                </span>
                <span className="font-medium">
                  {cacheMeta?.total_records ?? 0}
                  {' '}order
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Sinkronisasi terakhir
                </span>
                <span className="text-xs
                  text-gray-600">
                  {cacheMeta?.last_sync
                    ? new Date(cacheMeta.last_sync)
                        .toLocaleString('id-ID')
                    : 'Belum pernah'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Delta sync terakhir
                </span>
                <span className="text-xs
                  text-gray-600">
                  {cacheMeta?.last_delta_sync
                    ? new Date(
                        cacheMeta.last_delta_sync
                      ).toLocaleString('id-ID')
                    : 'Belum pernah'}
                </span>
              </div>
            </div>

            {/* Sync Message */}
            {syncMessage && (
              <p className="text-sm text-blue-600
                mb-3 bg-blue-50 px-3 py-2
                rounded-lg">
                {syncMessage}
              </p>
            )}

            {/* Tombol Sinkronisasi Ulang */}
            <button
              onClick={handleResync}
              disabled={isSyncing}
              className="w-full py-2.5
                bg-red-600 hover:bg-red-700
                disabled:opacity-50
                text-white text-sm font-medium
                rounded-xl transition"
            >
              {isSyncing
                ? '⏳ Memproses...'
                : '🔄 Sinkronisasi Ulang Data'}
            </button>

            <p className="text-xs text-gray-400
              mt-2 text-center">
              Hanya gunakan jika data tidak
              sinkron dengan server
            </p>
          </div>
        </div>
      )}

      {/* Add Instruction Modal */}
      <Modal
        isOpen={isAddInstructionModalOpen}
        onClose={() => setIsAddInstructionModalOpen(false)}
        title="Tambah Instruksi Kurir"
      >
        <div className="space-y-4">
          {/* Emoji Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Emoji
            </label>
            <div className="grid grid-cols-6 gap-2">
              {emojiOptions.map((emoji) => {
                const isSelected = newInstruction.icon === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewInstruction({ ...newInstruction, icon: emoji })}
                    className={`p-3 rounded-lg border transition-all flex items-center justify-center text-xl ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (Tampilan Dropdown)
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Judul instruksi yang muncul di dropdown (contoh: "Barang sudah siap, langsung ambil")
            </p>
            <Input
              value={newInstruction.label}
              onChange={(e) => setNewInstruction({ ...newInstruction, label: e.target.value })}
              placeholder="Barang sudah siap, langsung ambil"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instruksi untuk Kurir (Notifikasi)
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Pesan yang dikirim ke kurir saat order di-assign (contoh: "Barang sudah siap, langsung ambil!")
            </p>
            <Input
              value={newInstruction.instruction}
              onChange={(e) => setNewInstruction({ ...newInstruction, instruction: e.target.value })}
              placeholder="Barang sudah siap, langsung ambil!"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsAddInstructionModalOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleAddInstruction}
              className="flex-1"
            >
              Tambah Instruksi
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Instruction Modal */}
      <Modal
        isOpen={isEditInstructionModalOpen}
        onClose={() => setIsEditInstructionModalOpen(false)}
        title="Edit Instruksi Kurir"
      >
        <div className="space-y-4">
          {/* Emoji Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Emoji
            </label>
            <div className="grid grid-cols-6 gap-2">
              {emojiOptions.map((emoji) => {
                const isSelected = editInstructionForm.icon === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setEditInstructionForm({ ...editInstructionForm, icon: emoji })}
                    className={`p-3 rounded-lg border transition-all flex items-center justify-center text-xl ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (Tampilan Dropdown)
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Judul instruksi yang muncul di dropdown (contoh: "Barang sudah siap, langsung ambil")
            </p>
            <Input
              value={editInstructionForm.label}
              onChange={(e) => setEditInstructionForm({ ...editInstructionForm, label: e.target.value })}
              placeholder="Barang sudah siap, langsung ambil"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instruksi untuk Kurir (Notifikasi)
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Pesan yang dikirim ke kurir saat order di-assign (contoh: "Barang sudah siap, langsung ambil!")
            </p>
            <Input
              value={editInstructionForm.instruction}
              onChange={(e) => setEditInstructionForm({ ...editInstructionForm, instruction: e.target.value })}
              placeholder="Barang sudah siap, langsung ambil!"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsEditInstructionModalOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveEditInstruction}
              className="flex-1"
            >
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
