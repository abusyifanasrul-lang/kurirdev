import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-center">
                    <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 border border-red-500/30">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-white mb-2">Oops! Terjadi kesalahan</h1>
                        <p className="text-gray-400 mb-6 text-sm">
                            Aplikasi mengalami masalah saat memuat. Silakan coba muat ulang halaman.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Muat Ulang Halaman
                        </button>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <pre className="mt-6 p-4 bg-black/50 rounded text-left text-xs text-red-400 overflow-auto max-h-40">
                                {this.state.error.toString()}
                            </pre>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
