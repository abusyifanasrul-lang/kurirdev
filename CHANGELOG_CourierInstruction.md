# Dokumen Perubahan - Fitur Custom Kurir Instruction

**Tanggal:** 25 Maret 2026
**Sesi:** Implementasi Point 9 (Custom Kurir Instruction dengan Icon Picker)

---

## Ringkasan Perubahan

Fitur ini memungkinkan admin untuk mengelola instruksi kurir secara dinamis melalui halaman Settings. Instruksi yang ditambahkan akan muncul di dropdown saat assign order ke kurir.

### Struktur Data Final:
- `label`: Tampilan di dropdown
- `instruction`: Pesan yang dikirim ke kurir via notifikasi
- `iconName`: Nama ikon Lucide (CheckCircle, Search, MapPin, dll)

---

## File yang Berubah

### 1. `src/stores/useSettingsStore.ts`

**Perubahan:**
- Interface `CourierInstruction` disederhanakan dari 3 field menjadi 2 field + iconName
- Menambahkan default 4 instruksi dengan icon names
- CRUD methods tetap sama

**Actual Code:**
```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CourierInstruction {
  id: string;
  label: string;        // untuk display di dropdown (contoh: "Barang sudah siap, langsung ambil")
  instruction: string;  // untuk notifikasi ke kurir (contoh: "Barang sudah siap, langsung ambil!")
  iconName: string;     // nama ikon Lucide (contoh: "CheckCircle", "Search", "MapPin")
}

interface BusinessSettings {
  commission_rate: number        // default 80 (%)
  commission_threshold: number   // default 5000 (Rp)
  courier_instructions: CourierInstruction[]
}

interface SettingsStore extends BusinessSettings {
  updateSettings: (data: Partial<BusinessSettings>) => void
  addCourierInstruction: (instruction: Omit<CourierInstruction, 'id'>) => void
  updateCourierInstruction: (id: string, instruction: Partial<CourierInstruction>) => void
  deleteCourierInstruction: (id: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      commission_rate: 80,
      commission_threshold: 5000,
      courier_instructions: [
        {
          id: '1',
          label: 'Barang sudah siap, langsung ambil',
          instruction: 'Barang sudah siap, langsung ambil!',
          iconName: 'CheckCircle'
        },
        {
          id: '2',
          label: 'Cek dulu ke penjual sebelum ambil',
          instruction: 'Cek dulu ke penjual sebelum ambil',
          iconName: 'Search'
        },
        {
          id: '3',
          label: 'Kurir yang pesan di tempat',
          instruction: 'Kamu yang pesan di tempat',
          iconName: 'ShoppingCart'
        },
        {
          id: '4',
          label: 'Minta kurir update posisi',
          instruction: 'Admin minta update posisimu',
          iconName: 'MapPin'
        }
      ],
      updateSettings: (data) => set((state) => ({ ...state, ...data })),
      addCourierInstruction: (instruction) => set((state) => ({
        courier_instructions: [...state.courier_instructions, { ...instruction, id: crypto.randomUUID() }]
      })),
      updateCourierInstruction: (id, instruction) => set((state) => ({
        courier_instructions: state.courier_instructions.map(item =>
          item.id === id ? { ...item, ...instruction } : item
        )
      })),
      deleteCourierInstruction: (id) => set((state) => ({
        courier_instructions: state.courier_instructions.filter(item => item.id !== id)
      }))
    }),
    { name: 'business-settings', storage: createJSONStorage(() => localStorage) }
  )
)
```

---

### 2. `src/pages/Settings.tsx`

**Perubahan:**
- Menambah tab baru "Instruksi Kurir" di navigation tabs
- Menambah icon picker dengan 11 pilihan ikon (grid 6x2)
- Modal Add/Edit dengan 2 field (Label, Instruction) + Icon Picker
- Helper function `renderIcon()` untuk render ikon dinamis
- CRUD handlers untuk instruksi

**Key Imports:**
```typescript
import { 
  User, Lock, Users, Plus, CheckCircle, AlertCircle, Shield, 
  Edit2, UserX, RefreshCw, Eye, EyeOff, Settings as SettingsIcon, 
  Trash2, Edit3, Search, ShoppingCart, MapPin, Truck, Package, 
  Clock, AlertTriangle, MessageCircle, Phone, Navigation 
} from 'lucide-react';
import type { CourierInstruction } from '@/stores/useSettingsStore';
```

**State Management:**
```typescript
const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'users' | 'business' | 'instructions'>('profile');

const [isAddInstructionModalOpen, setIsAddInstructionModalOpen] = useState(false);
const [isEditInstructionModalOpen, setIsEditInstructionModalOpen] = useState(false);
const [selectedInstructionToEdit, setSelectedInstructionToEdit] = useState<CourierInstruction | null>(null);
const [newInstruction, setNewInstruction] = useState({ label: '', instruction: '', iconName: 'CheckCircle' });
const [editInstructionForm, setEditInstructionForm] = useState({ label: '', instruction: '', iconName: 'CheckCircle' });
```

**Icon Options:**
```typescript
const iconOptions = [
  { name: 'CheckCircle', icon: CheckCircle, label: 'Check' },
  { name: 'Search', icon: Search, label: 'Search' },
  { name: 'ShoppingCart', icon: ShoppingCart, label: 'Cart' },
  { name: 'MapPin', icon: MapPin, label: 'Location' },
  { name: 'Truck', icon: Truck, label: 'Truck' },
  { name: 'Package', icon: Package, label: 'Package' },
  { name: 'Clock', icon: Clock, label: 'Clock' },
  { name: 'AlertTriangle', icon: AlertTriangle, label: 'Alert' },
  { name: 'MessageCircle', icon: MessageCircle, label: 'Message' },
  { name: 'Phone', icon: Phone, label: 'Phone' },
  { name: 'Navigation', icon: Navigation, label: 'Navigate' },
];

const renderIcon = (iconName: string, className?: string) => {
  const iconOption = iconOptions.find(opt => opt.name === iconName);
  if (!iconOption) return null;
  const IconComponent = iconOption.icon;
  return <IconComponent className={className || "h-5 w-5"} />;
};
```

**Tab Navigation:**
```typescript
const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'users', label: 'System Users', icon: Users },
  { id: 'business', label: 'Business', icon: Shield },
  { id: 'instructions', label: 'Instruksi Kurir', icon: SettingsIcon },
] as const;
```

**Handlers:**
```typescript
const handleAddInstruction = () => {
  if (!newInstruction.label || !newInstruction.instruction) {
    showMessage('error', 'Label dan instruksi harus diisi!');
    return;
  }
  addCourierInstruction(newInstruction);
  setIsAddInstructionModalOpen(false);
  setNewInstruction({ label: '', instruction: '', iconName: 'CheckCircle' });
  showMessage('success', 'Instruksi berhasil ditambahkan!');
};

const openEditInstructionModal = (instruction: CourierInstruction) => {
  setSelectedInstructionToEdit(instruction);
  setEditInstructionForm({
    label: instruction.label,
    instruction: instruction.instruction,
    iconName: instruction.iconName
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
  setEditInstructionForm({ label: '', instruction: '', iconName: 'CheckCircle' });
  showMessage('success', 'Instruksi berhasil diperbarui!');
};

const handleDeleteInstruction = (id: string) => {
  if (window.confirm('Apakah Anda yakin ingin menghapus instruksi ini?')) {
    deleteCourierInstruction(id);
    showMessage('success', 'Instruksi berhasil dihapus!');
  }
};
```

**Tab Content (Instruksi Kurir):**
```tsx
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
      {courier_instructions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <SettingsIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Belum ada instruksi kurir</p>
          <p className="text-sm">Tambah instruksi untuk memudahkan admin saat assign order</p>
        </div>
      ) : (
        courier_instructions.map((instruction) => (
          <div key={instruction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                {renderIcon(instruction.iconName, "h-5 w-5")}
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
```

**Add Instruction Modal (dengan Icon Picker):**
```tsx
<Modal
  isOpen={isAddInstructionModalOpen}
  onClose={() => setIsAddInstructionModalOpen(false)}
  title="Tambah Instruksi Kurir"
>
  <div className="space-y-4">
    {/* Icon Picker */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Pilih Ikon
      </label>
      <div className="grid grid-cols-6 gap-2">
        {iconOptions.map((iconOpt) => {
          const IconComponent = iconOpt.icon;
          const isSelected = newInstruction.iconName === iconOpt.name;
          return (
            <button
              key={iconOpt.name}
              type="button"
              onClick={() => setNewInstruction({ ...newInstruction, iconName: iconOpt.name })}
              className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                  : 'border-gray-200 hover:border-gray-300 text-gray-500'
              }`}
            >
              <IconComponent className="h-5 w-5" />
              <span className="text-[10px]">{iconOpt.label}</span>
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
```

---

### 3. `src/pages/Orders.tsx`

**Perubahan:**
- Update dropdown instruksi untuk menggunakan struktur baru (tanpa field `value`)
- Update logic matching untuk menggunakan `label` sebagai key
- Update useSettingsStore destructuring untuk include `courier_instructions`

**Key Changes:**
```typescript
// Import (CourierInstruction dihapus karena tidak digunakan langsung)
import type { Order, CreateOrderPayload, PaymentStatus } from '@/types';

// Destructuring dari useSettingsStore
const { commission_rate, commission_threshold, courier_instructions } = useSettingsStore();
```

**Dropdown Update:**
```tsx
<select
  value={selectedOrder?.notes || ''}
  onChange={e => setSelectedOrder(selectedOrder ? { ...selectedOrder, notes: e.target.value } : null)}
  className="w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
>
  <option value="">— Tidak ada instruksi khusus —</option>
  {courier_instructions.map((instruction) => (
    <option key={instruction.id} value={instruction.label}>
      {instruction.label}
    </option>
  ))}
</select>
```

**Logic Assign Update:**
```typescript
// Buat teks instruksi (dinamis dari settings)
const notes = (selectedOrder.notes || '').toLowerCase().trim();
const selectedInstruction = courier_instructions.find(
  instruction => instruction.label.toLowerCase() === notes
);
const instruksi = selectedInstruction 
  ? selectedInstruction.instruction
  : notes
  ? `📋 ${selectedOrder.notes}` 
  : 'Segera proses!';
```

---

## Fitur yang Tersedia

1. **Settings Page** → Tab "Instruksi Kurir"
   - Lihat semua instruksi yang ada
   - Tambah instruksi baru dengan icon picker
   - Edit instruksi yang ada
   - Hapus instruksi yang tidak perlu

2. **Orders Page** → Detail Order Modal
   - Dropdown "Instruksi untuk Kurir" menampilkan instruksi dari settings
   - Value menggunakan `label` sebagai identifier

3. **Notifikasi**
   - Saat assign order dengan instruksi, notifikasi ke kurir menggunakan field `instruction`

---

## Icon Options yang Tersedia

| Icon Name | Label | Visual |
|-----------|-------|--------|
| CheckCircle | Check | ✅ |
| Search | Search | 🔍 |
| ShoppingCart | Cart | 🛒 |
| MapPin | Location | 📍 |
| Truck | Truck | 🚚 |
| Package | Package | 📦 |
| Clock | Clock | ⏰ |
| AlertTriangle | Alert | ⚠️ |
| MessageCircle | Message | 💬 |
| Phone | Phone | 📞 |
| Navigation | Navigate | 🧭 |

---

## Catatan Migrasi Data

Karena localStorage masih menyimpan data lama dengan field `value`, disarankan untuk:
1. Clear browser localStorage, atau
2. Reset data settings untuk load struktur baru dengan default 4 instruksi

**Cara reset:** Buka DevTools → Application → Local Storage → Hapus key `business-settings`

---

## End of Document
