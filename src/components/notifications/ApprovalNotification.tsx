import { CheckCircle, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ApprovalNotificationProps {
  id: string;
  orderNumber?: string;
  requesterName?: string;
  onClose: () => void;
}

export function ApprovalNotification({ orderNumber, requesterName, onClose }: Omit<ApprovalNotificationProps, 'id'>) {
  const navigate = useNavigate();

  return (
    <div className="bg-white border-l-4 border-teal-500 shadow-xl rounded-lg p-4 mb-3 animate-in slide-in-from-right duration-300 max-w-sm w-full">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-teal-100 rounded-full">
          <CheckCircle className="h-5 w-5 text-teal-600" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900">Persetujuan Data Baru</h4>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <p className="text-xs text-gray-600 mt-1">
            <span className="font-semibold text-gray-800">{requesterName || 'Kurir'}</span> telah mengajukan perubahan data untuk Order <span className="font-bold text-teal-600">#{orderNumber || 'N/A'}</span>.
          </p>
          
          <button
            onClick={() => {
              navigate('/admin/settings?tab=approvals');
              onClose();
            }}
            className="mt-3 flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Tinjau Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}
