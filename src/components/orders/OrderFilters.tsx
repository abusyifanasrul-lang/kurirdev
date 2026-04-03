import { Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const statusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'pending', label: '⏳ Menunggu Kurir' },
  { value: 'assigned', label: '📲 Kurir Ditugaskan' },
  { value: 'picked_up', label: '🛵 GAS — Menuju Penjual' },
  { value: 'in_transit', label: '🛵 GAS — Menuju Customer' },
  { value: 'delivered', label: '✅ CEKLIS — Terkirim' },
  { value: 'cancelled', label: '❌ CANCEL — Dibatalkan' },
];

const searchCategories = [
  { value: 'all', label: 'All Fields' },
  { value: 'order_number', label: 'Order ID' },
  { value: 'customer_name', label: 'Customer' },
  { value: 'customer_phone', label: 'Phone' },
  { value: 'courier_name', label: 'Courier' },
  { value: 'customer_address', label: 'Address' },
];

interface OrderFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchCategory: string;
  setSearchCategory: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  dateFilter: { start: string; end: string };
  handleDateFilterChange: (start: string, end: string) => void;
}

export function OrderFilters({
  searchQuery,
  setSearchQuery,
  searchCategory,
  setSearchCategory,
  statusFilter,
  setStatusFilter,
  dateFilter,
  handleDateFilterChange,
}: OrderFiltersProps) {
  return (
    <Card className="mb-6">
      <div className="flex flex-col lg:flex-row flex-wrap gap-4">
        <div className="flex-1 min-w-[300px] flex gap-2">
          <div className="w-40">
            <Select
              options={searchCategories}
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </div>
        <div className="w-full lg:w-48">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Status"
          />
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <Input 
            type="date" 
            value={dateFilter.start} 
            onChange={(e) => handleDateFilterChange(e.target.value, dateFilter.end)} 
          />
          <Input 
            type="date" 
            value={dateFilter.end} 
            onChange={(e) => handleDateFilterChange(dateFilter.start, e.target.value)} 
          />
        </div>
      </div>
    </Card>
  );
}
