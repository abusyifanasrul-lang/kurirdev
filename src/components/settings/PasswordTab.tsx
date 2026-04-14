import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface PasswordTabProps {
  onUpdate: (data: any) => Promise<void>;
  isLoading: boolean;
}

export function PasswordTab({ onUpdate, isLoading }: PasswordTabProps) {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async () => {
    await onUpdate(form);
    // Logic to clear form if success is usually handled by parent 
    // or we can handle it here if onUpdate returns success.
    // For now, parent might trigger a reset or component might unmount.
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Change Password</h3>
      <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <Input
          label="Current Password"
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          className="bg-white"
        />
        <div className="hidden md:block" /> {/* Spacer */}
        <Input
          label="New Password"
          type="password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          helperText="Min 8 characters"
          className="bg-white"
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          className="bg-white"
        />
      </div>
        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!form.currentPassword || !form.newPassword || !form.confirmPassword}
          >
            Update Password
          </Button>
        </div>
      </div>
    </Card>
  );
}
