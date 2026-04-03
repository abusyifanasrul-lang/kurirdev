import { useEffect, useState } from 'react'
import { useToastStore, Toast as ToastType } from '@/stores/useToastStore'
import { cn } from '@/utils/cn'
import { X, CheckCircle2, AlertCircle, Info, Loader2, AlertTriangle } from 'lucide-react'

export const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts)
  
  return (
    <div 
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[320px] max-w-[90vw]"
      role="region"
      aria-label="Notifikasi sistem"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

const ToastItem = ({ toast }: { toast: ToastType }) => {
  const removeToast = useToastStore((s) => s.removeToast)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    loading: <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
  }

  const bgColors = {
    success: 'bg-emerald-50/90 border-emerald-100',
    error: 'bg-rose-50/90 border-rose-100',
    info: 'bg-blue-50/90 border-blue-100',
    warning: 'bg-amber-50/90 border-amber-100',
    loading: 'bg-white/90 border-gray-100 shadow-xl'
  }

  return (
    <div
      role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
      aria-atomic="true"
      className={cn(
        'group relative flex items-center gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-lg transition-all duration-300 ease-out transform',
        bgColors[toast.type],
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'
      )}
    >
      <div className="shrink-0">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium leading-tight",
          toast.type === 'loading' ? 'text-gray-700' : 'text-gray-900'
        )}>
          {toast.message}
        </p>
      </div>
      {toast.type !== 'loading' && (
        <button
          onClick={() => removeToast(toast.id)}
          className="shrink-0 p-1 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      {/* Progress bar for auto-expiring toasts */}
      {toast.duration && toast.duration > 0 && toast.type !== 'loading' && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-black/5 w-full overflow-hidden rounded-b-2xl">
          <div 
            className={cn(
              "h-full transition-all linear",
              toast.type === 'success' ? 'bg-emerald-500/30' :
              toast.type === 'error' ? 'bg-rose-500/30' :
              toast.type === 'info' ? 'bg-blue-500/30' : 'bg-teal-500/30'
            )}
            style={{ 
              animation: `toast-progress ${toast.duration}ms linear forwards` 
            }}
          />
        </div>
      )}
      
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}
