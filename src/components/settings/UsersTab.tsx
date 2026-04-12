import { useState } from 'react';
import { Plus, Shield, Edit2, UserX, RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import type { User as UserType, UserRole, Courier } from '@/types';
import { CourierBadge } from '@/components/couriers/CourierBadge';

interface UsersTabProps {
  currentUser: UserType | null;
  users: UserType[];
  onAddUser: (data: any) => Promise<{ success: boolean; error?: string }>;
  onUpdateUser: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  onToggleSuspend: (user: UserType) => void;
}

export function UsersTab({
  currentUser,
  users,
  onAddUser,
  onUpdateUser,
  onToggleSuspend,
}: UsersTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newForm, setNewForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'courier' as UserRole,
    phone: '',
    vehicle_type: 'motorcycle' as Courier['vehicle_type'],
    plate_number: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '' as UserRole,
    password: '',
    vehicle_type: 'motorcycle' as Courier['vehicle_type'],
    plate_number: '',
  });

  const showLocalMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getAvailableRoles = () => {
    // Super Admin (God View) - All Roles
    if (currentUser?.role === 'admin') {
      return [
        { value: 'admin', label: 'Super Admin (God View)' },
        { value: 'admin_kurir', label: 'Admin Kurir (Operations)' },
        { value: 'owner', label: 'Owner (Business)' },
        { value: 'finance', label: 'Keuangan (Finance)' },
        { value: 'courier', label: 'Kurir (Field)' },
      ];
    }
    
    // Owner (Business Pilot)
    if (currentUser?.role === 'owner') {
      return [
        { value: 'admin', label: 'Super Admin (System)' },
        { value: 'admin_kurir', label: 'Admin Kurir' },
        { value: 'finance', label: 'Keuangan' },
        { value: 'courier', label: 'Kurir' },
      ];
    }

    // Admin Kurir (Operations Lead)
    if (currentUser?.role === 'admin_kurir') {
      return [
        { value: 'courier', label: 'Kurir' },
      ];
    }
    
    return [{ value: 'courier', label: 'Kurir' }];
  };

  const getVisibleUsers = () => {
    if (currentUser?.role === 'admin') return users; // God View: See Everything
    if (currentUser?.role === 'owner') return users; // Owner: See Everything
    if (currentUser?.role === 'admin_kurir') return users.filter(u => u.role === 'courier' || u.role === 'admin_kurir' || u.id === currentUser.id);
    return users.filter(u => u.id === currentUser?.id);
  };

  const canEdit = (u: UserType) => {
    if (u.id === currentUser?.id) return true;
    if (currentUser?.role === 'admin') return true; // God View: Can Edit All
    if (currentUser?.role === 'owner') return u.role !== 'admin'; // Owner can edit all except Super Admin
    if (currentUser?.role === 'admin_kurir') return u.role === 'courier';
    return false;
  };

  const handleAddSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const resp = await onAddUser(newForm);
      if (resp.success) {
        setIsAddModalOpen(false);
        setNewForm({
          name: '',
          email: '',
          password: '',
          role: 'courier',
          phone: '',
          vehicle_type: 'motorcycle',
          plate_number: '',
        });
        showLocalMessage('success', 'User berhasil ditambahkan!');
      } else {
        showLocalMessage('error', resp.error || 'Gagal menambahkan user');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedUser || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const updates: any = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
        vehicle_type: editForm.role === 'courier' ? editForm.vehicle_type : undefined,
        plate_number: editForm.role === 'courier' ? editForm.plate_number : undefined,
      };
      
      if (editForm.password) {
        updates.password = editForm.password;
      }

      const result = await onUpdateUser(selectedUser.id, updates);
      
      if (result.success) {
        showLocalMessage('success', 'User berhasil diperbarui!');
        setIsEditModalOpen(false);
        setSelectedUser(null);
      } else {
        showLocalMessage('error', result.error || 'Gagal memperbarui user');
      }
    } catch (err: any) {
      showLocalMessage('error', err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: UserType) => {
    setSelectedUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      password: '',
      vehicle_type: (u as Courier).vehicle_type || 'motorcycle',
      plate_number: (u as Courier).plate_number || '',
    });
    setIsEditModalOpen(true);
  };

  const visibleUsers = getVisibleUsers();

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">System Users</h3>
          <p className="text-sm text-gray-500 mt-1">Manage platform users and permissions</p>
        </div>
        {(currentUser?.role === 'admin' || currentUser?.role === 'owner' || currentUser?.role === 'admin_kurir') && (
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setIsAddModalOpen(true);
              setNewForm(prev => ({ ...prev, role: getAvailableRoles()[0]?.value as any || 'courier' }));
            }}
          >
            Add User
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {visibleUsers.map((u) => (
          <div
            key={u.id}
            className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-lg gap-4 transition-all ${
              u.is_active ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-100/50 opacity-60 grayscale-[0.5]'
            } ${canEdit(u) ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => canEdit(u) && openEditModal(u)}
          >
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-opacity ${
                !u.is_active ? 'opacity-50' : ''
              } ${u.role === 'admin' || u.role === 'owner' ? 'bg-teal-100 text-teal-600' : 'bg-orange-100 text-orange-600'}`}>
                {u.role === 'admin' || u.role === 'owner' ? <Shield className="w-5 h-5" /> : u.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{u.name}</p>
                  {u.role === 'courier' && (
                    <CourierBadge type={(u as Courier).vehicle_type} showLabel={false} className="border-none bg-transparent p-0" />
                  )}
                  {u.id === currentUser?.id && <Badge variant="info" size="sm">You</Badge>}
                  {!u.is_active && <Badge variant="danger" size="sm" className="bg-red-100 text-red-700 animate-pulse">NON-AKTIF</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">{u.email}</p>
                  {u.role === 'courier' && (u as Courier).plate_number && (
                    <span className="text-[10px] text-gray-400 font-mono">[{ (u as Courier).plate_number }]</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Badge variant={u.role === 'admin' ? 'default' : 'warning'} className="capitalize">
                {u.role.replace('_', ' ')}
              </Badge>

              {canEdit(u) && (
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(u); }}
                  className="p-2 text-teal-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}

              {(currentUser?.role === 'admin' || currentUser?.role === 'owner') && u.id !== currentUser.id && u.role === 'courier' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSuspend(u); }}
                  className={`p-2 rounded-lg transition-colors ${
                    u.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-teal-400 hover:text-teal-600 hover:bg-teal-50'
                  }`}
                >
                  {u.is_active ? <UserX className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Tambah User Baru">
        <div className="space-y-4">
          {message && (
             <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
               {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
               {message.text}
             </div>
          )}
          <Input label="Nama Lengkap" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
          <Input label="Alamat Email" type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} />
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={newForm.password}
            onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
            rightIcon={
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1 text-gray-400">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
            <Select
              label="Role"
              value={newForm.role}
              onChange={(e) => setNewForm({ ...newForm, role: e.target.value as any })}
              options={getAvailableRoles()}
            />
          {newForm.role === 'courier' && (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Jenis Kendaraan"
                value={newForm.vehicle_type}
                onChange={(e) => setNewForm({ ...newForm, vehicle_type: e.target.value as any })}
                options={[{value:'motorcycle',label:'Motor'},{value:'car',label:'Mobil'},{value:'bicycle',label:'Sepeda'},{value:'van',label:'Van'}]}
              />
              <Input label="Plate Number" value={newForm.plate_number} onChange={(e) => setNewForm({ ...newForm, plate_number: e.target.value })} />
            </div>
          )}
          <Input label="Telepon" value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Batal</Button>
            <Button onClick={handleAddSubmit} isLoading={isSubmitting}>Simpan User</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit User: ${selectedUser?.name}`}>
        <div className="space-y-4">
          <Input label="Nama Lengkap" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Alamat Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Input label="Telepon" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <Select
              label="Role"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
              options={getAvailableRoles()}
              disabled={selectedUser?.id === currentUser?.id}
            />
          {editForm.role === 'courier' && (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Jenis Kendaraan"
                value={editForm.vehicle_type}
                onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value as any })}
                options={[{value:'motorcycle',label:'Motor'},{value:'car',label:'Mobil'},{value:'bicycle',label:'Sepeda'},{value:'van',label:'Van'}]}
              />
              <Input label="Plate Number" value={editForm.plate_number} onChange={(e) => setEditForm({ ...editForm, plate_number: e.target.value })} />
            </div>
          )}
          <div className="pt-2 border-t text-sm">
            <h4 className="font-medium mb-1">Reset Password</h4>
            <div className="relative">
              <input
                id="reset-password-input"
                type={showPassword ? 'text' : 'password'}
                aria-label="Set new password for user"
                className="w-full px-3 py-2 border rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                placeholder="Kosongkan jika tidak ingin diubah"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
            <Button onClick={handleEditSubmit} isLoading={isSubmitting}>Simpan Perubahan</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
