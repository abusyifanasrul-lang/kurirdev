import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { User as UserType } from '@/types';
import { BellRing } from 'lucide-react';

interface ProfileTabProps {
  user: UserType | null;
  onUpdate: (updates: any) => Promise<void>;
  onRefreshPush: () => Promise<void>;
  isLoading: boolean;
  isRefreshingPush: boolean;
}

export function ProfileTab({
  user,
  onUpdate,
  onRefreshPush,
  isLoading,
  isRefreshingPush,
}: ProfileTabProps) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const handleSubmit = async () => {
    await onUpdate(form);
  };

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h3>
        <div className="space-y-4 max-w-md">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Phone Number"
            value={form.phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, phone: e.target.value })}
            placeholder="+628..."
          />
          <div className="pt-4 flex flex-col gap-3">
            <Button onClick={handleSubmit} isLoading={isLoading}>
              Save Changes
            </Button>
            
            {user?.role === 'courier' && (
              <div className="pt-4 border-t border-gray-100 mt-2">
                <p className="text-xs text-gray-500 mb-2 font-medium">
                  Bermasalah dengan notifikasi?
                </p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full sm:w-auto"
                  leftIcon={<BellRing className="h-4 w-4" />}
                  onClick={onRefreshPush}
                  isLoading={isRefreshingPush}
                >
                  Refresh Push Notification
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
