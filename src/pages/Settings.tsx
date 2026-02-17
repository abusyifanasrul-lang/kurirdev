import { useState } from 'react';
import { User, Lock, Users, Plus, Trash2, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import type { User as UserType } from '@/types';

// Store
import { useUserStore } from '@/stores/useUserStore';

export function Settings() {
  const { user, users, updateUser, addUser, removeUser } = useUserStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'users'>('profile');

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
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'admin', phone: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Helper to show msg
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

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
    const userData: UserType = {
      id: Date.now(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role as 'admin' | 'courier',
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

  const handleRemoveUser = (userId: number) => {
    if (userId === user?.id) {
      showMessage('error', 'You cannot remove yourself!');
      return;
    }
    // RBAC: Only Super Admin (id 1) can remove others
    if (user?.id !== 1) {
      showMessage('error', 'Only Super Admin can remove users!');
      return;
    }

    removeUser(userId);
    showMessage('success', 'User removed successfully!');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'users', label: 'System Users', icon: Users },
  ] as const;

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
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 rounded-lg gap-4"
                  >
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                        {u.role === 'admin' ? <Shield className="w-5 h-5" /> : u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{u.name}</p>
                          {u.id === user?.id && <Badge variant="info" size="sm">You</Badge>}
                        </div>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      <Badge variant={u.role === 'admin' ? 'default' : 'warning'} className="capitalize">
                        {u.role.replace('_', ' ')}
                      </Badge>

                      {/* Delete Action - RBAC Protected */}
                      {user?.id === 1 && u.id !== 1 && u.id !== user.id && (
                        <button
                          onClick={() => handleRemoveUser(u.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove User"
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

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Add New User"
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
            <Input
              label="Password"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="Min 8 chars"
            />
            <Select
              label="Role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'courier', label: 'Courier' }
              ]}
            />
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
    </div>
  );
}
