import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MapPin } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useActiveBasecamp } from '@/hooks/useActiveBasecamp';

interface BasecampSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (basecampId: string) => void;
}

export function BasecampSelectionModal({ 
  isOpen, 
  onClose, 
  onSelect 
}: BasecampSelectionModalProps) {
  const { basecamps } = useSettingsStore();
  const { setActiveBasecamp } = useActiveBasecamp();
  const [selectedId, setSelectedId] = useState('');

  const activeBasecamps = basecamps.filter((b: any) => b.is_active);

  const handleSetAndGenerate = () => {
    if (selectedId) {
      setActiveBasecamp(selectedId);
      onSelect(selectedId);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pilih Basecamp untuk Instance Ini"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-100 rounded-xl">
          <MapPin className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-900">
              Instance belum dikonfigurasi
            </p>
            <p className="text-xs text-purple-700 mt-1">
              Pilih basecamp dimana instance aplikasi ini berjalan. QR code yang di-generate akan terikat dengan basecamp ini.
            </p>
          </div>
        </div>

        {activeBasecamps.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-semibold">Tidak ada basecamp aktif</p>
            <p className="text-xs mt-1">
              Aktifkan basecamp di Settings terlebih dahulu.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Basecamp
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">-- Pilih Basecamp --</option>
                {activeBasecamps.map((basecamp: any) => (
                  <option key={basecamp.id} value={basecamp.id}>
                    {basecamp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                onClick={handleSetAndGenerate}
                disabled={!selectedId}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set & Generate QR
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
