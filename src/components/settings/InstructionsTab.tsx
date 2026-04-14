import { useState } from 'react';
import { Plus, Edit3, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { CourierInstruction } from '@/stores/useSettingsStore';

interface InstructionsTabProps {
  instructions: CourierInstruction[];
  onAdd: (data: Omit<CourierInstruction, 'id'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<CourierInstruction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const emojiOptions = ['✅', '📦', '🏠', '📞', '💰', '📍', '🛵', '🕒', '⚠️', '📝', '🤝', '⚡'];

export function InstructionsTab({
  instructions,
  onAdd,
  onUpdate,
  onDelete,
}: InstructionsTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInstruction, setSelectedInstruction] = useState<CourierInstruction | null>(null);
  
  const [newForm, setNewForm] = useState({ label: '', instruction: '', icon: '✅' });
  const [editForm, setEditForm] = useState({ label: '', instruction: '', icon: '✅' });

  const handleAdd = async () => {
    await onAdd(newForm);
    setIsAddModalOpen(false);
    setNewForm({ label: '', instruction: '', icon: '✅' });
  };

  const handleEdit = async () => {
    if (!selectedInstruction) return;
    await onUpdate(selectedInstruction.id, editForm);
    setIsEditModalOpen(false);
    setSelectedInstruction(null);
  };

  const openEditModal = (instruction: CourierInstruction) => {
    setSelectedInstruction(instruction);
    setEditForm({
      label: instruction.label,
      instruction: instruction.instruction,
      icon: instruction.icon,
    });
    setIsEditModalOpen(true);
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Instruksi Kurir</h3>
          <p className="text-sm text-gray-500 mt-1">Kelola instruksi yang muncul di dropdown order</p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Tambah Instruksi
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {instructions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <SettingsIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Belum ada instruksi kurir</p>
            <p className="text-sm">Tambah instruksi untuk memudahkan admin saat assign order</p>
          </div>
        ) : (
          instructions.map((instruction) => (
            <div key={instruction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center text-teal-600">
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
                  onClick={() => openEditModal(instruction)}
                  className="text-teal-600 hover:text-teal-700"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(instruction.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Instruksi Kurir"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Emoji</label>
            <div className="grid grid-cols-6 gap-2">
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewForm({ ...newForm, icon: emoji })}
                  className={`p-3 rounded-lg border transition-all flex items-center justify-center text-xl ${
                    newForm.icon === emoji ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
            <Input
              label="Label"
              value={newForm.label}
              onChange={(e) => setNewForm({ ...newForm, label: e.target.value })}
              placeholder="Contoh: Barang sudah siap"
            />
            <Input
              label="Pesan Notifikasi"
              value={newForm.instruction}
              onChange={(e) => setNewForm({ ...newForm, instruction: e.target.value })}
              placeholder="Pesan yang akan dikirim ke kurir"
            />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">Batal</Button>
            <Button onClick={handleAdd} className="flex-1">Tambah</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Instruksi Kurir"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Emoji</label>
            <div className="grid grid-cols-6 gap-2">
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setEditForm({ ...editForm, icon: emoji })}
                  className={`p-3 rounded-lg border transition-all flex items-center justify-center text-xl ${
                    editForm.icon === emoji ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
            <Input
              label="Label"
              value={editForm.label}
              onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
            />
            <Input
              label="Pesan Notifikasi"
              value={editForm.instruction}
              onChange={(e) => setEditForm({ ...editForm, instruction: e.target.value })}
            />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">Batal</Button>
            <Button onClick={handleEdit} className="flex-1">Simpan</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
