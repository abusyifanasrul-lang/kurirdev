import { useState } from 'react';
import { User, Lock, Users, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import type { User as UserType } from '@/types';

export function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'admins'>('profile');

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

  // Admin management state
  const [admins, setAdmins] = useState<UserType[]>([
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@delivery.com',
      role: 'admin',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 6,
      name: 'Manager User',
      email: 'manager@delivery.com',
      role: 'admin',
      is_active: true,
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-01T00:00:00Z',
    },
  ]);
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setMessage({ type: 'success', text: 'Profile updated successfully!' });
    setIsLoading(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match!' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters!' });
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMessage({ type: 'success', text: 'Password changed successfully!' });
    setIsLoading(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddAdmin = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newAdminUser: UserType = {
      id: admins.length + 10,
      name: newAdmin.name,
      email: newAdmin.email,
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setAdmins([...admins, newAdminUser]);
    setIsAddAdminModalOpen(false);
    setNewAdmin({ name: '', email: '', password: '' });
    setMessage({ type: 'success', text: 'Admin user added successfully!' });
    setIsLoading(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRemoveAdmin = async (adminId: number) => {
    if (adminId === user?.id) {
      setMessage({ type: 'error', text: 'You cannot remove yourself!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setAdmins(admins.filter((a) => a.id !== adminId));
    setMessage({ type: 'success', text: 'Admin user removed successfully!' });
    setIsLoading(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'admins', label: 'Admin Users', icon: Users },
  ] as const;

  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage your account and system settings" />

      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                message.type === 'success'
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

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
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
                  placeholder="+62812345678"
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
                  helperText="Min 8 characters, 1 uppercase, 1 number"
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

          {/* Admin Users Tab */}
          {activeTab === 'admins' && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Admin Users</h3>
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setIsAddAdminModalOpen(true)}
                >
                  Add Admin
                </Button>
              </div>

              <div className="space-y-4">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-medium">
                        {admin.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{admin.name}</p>
                        <p className="text-sm text-gray-500">{admin.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="success">Active</Badge>
                      {admin.id !== user?.id && (
                        <button
                          onClick={() => handleRemoveAdmin(admin.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove Admin"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add Admin Modal */}
      <Modal
        isOpen={isAddAdminModalOpen}
        onClose={() => setIsAddAdminModalOpen(false)}
        title="Add Admin User"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={newAdmin.name}
            onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
            placeholder="Enter admin's full name"
          />
          <Input
            label="Email Address"
            type="email"
            value={newAdmin.email}
            onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
            placeholder="admin@example.com"
          />
          <Input
            label="Password"
            type="password"
            value={newAdmin.password}
            onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
            placeholder="Min 8 characters"
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddAdminModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAdmin}
              isLoading={isLoading}
              disabled={!newAdmin.name || !newAdmin.email || !newAdmin.password}
            >
              Add Admin
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
