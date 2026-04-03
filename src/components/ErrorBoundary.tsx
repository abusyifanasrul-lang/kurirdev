import { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '../lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Uncaught component error', { error, errorInfo })
    
    // Log to Supabase for developer review
    this.logErrorToSupabase(error, errorInfo)
  }

  private async logErrorToSupabase(error: Error, errorInfo: ErrorInfo) {
    try {
      const { supabase } = await import('../lib/supabaseClient')
      const { user } = (await supabase.auth.getSession()).data.session || { user: null }
      
      await (supabase.from('client_logs') as any).insert({
        level: 'error',
        message: error.message || 'Unknown React Error',
        stack_trace: error.stack,
        context: {
          componentStack: errorInfo.componentStack,
          userAgent: navigator.userAgent,
          platform: navigator.platform
        },
        user_id: user?.id,
        url: window.location.href
      })
    } catch (e) {
      console.error('Failed to log error to Supabase:', e)
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Aduh! Ada Masalah</h1>
            <p className="text-gray-600 mb-6">
              Aplikasi mengalami kesalahan yang tidak terduga. Silakan coba segarkan halaman.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-teal-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-teal-700 transition shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                Segarkan Halaman
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-4 rounded-xl hover:bg-gray-200 transition active:scale-[0.98]"
                title="Coba kembali ke halaman sebelumnya"
              >
                Coba Lagi
              </button>
            </div>
            {this.state.error && (
              <div className="mt-6 text-left p-4 bg-gray-900 rounded-lg overflow-auto max-h-40">
                <code className="text-xs text-red-400 break-all">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
