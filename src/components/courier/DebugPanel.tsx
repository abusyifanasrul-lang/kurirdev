import { useState, useEffect } from 'react';
import { Bug, X, Trash2, Copy, CheckCircle, Smartphone, Wifi, User, Shield } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  data?: any;
  stack?: string;
}

interface SystemInfo {
  platform: string;
  osVersion: string;
  model: string;
  manufacturer: string;
  appVersion: string;
  isNative: boolean;
  networkStatus: string;
  networkType: string;
}

export function DebugPanel() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [showSystemInfo, setShowSystemInfo] = useState(false);

  // Collect system info
  useEffect(() => {
    const collectSystemInfo = async () => {
      try {
        const info: SystemInfo = {
          platform: Capacitor.getPlatform(),
          osVersion: 'Unknown',
          model: 'Unknown',
          manufacturer: 'Unknown',
          appVersion: '1.1.0',
          isNative: Capacitor.isNativePlatform(),
          networkStatus: 'Unknown',
          networkType: 'Unknown',
        };

        if (Capacitor.isNativePlatform()) {
          // Get device info
          const deviceInfo = await Device.getInfo();
          info.osVersion = deviceInfo.osVersion || 'Unknown';
          info.model = deviceInfo.model || 'Unknown';
          info.manufacturer = deviceInfo.manufacturer || 'Unknown';

          // Get network status
          const networkStatus = await Network.getStatus();
          info.networkStatus = networkStatus.connected ? 'Online' : 'Offline';
          info.networkType = networkStatus.connectionType || 'Unknown';
        } else {
          info.networkStatus = navigator.onLine ? 'Online' : 'Offline';
          info.networkType = 'Web';
        }

        setSystemInfo(info);
      } catch (error) {
        console.error('[DebugPanel] Failed to collect system info:', error);
      }
    };

    collectSystemInfo();
  }, []);

  useEffect(() => {
    // Intercept console.log, console.error, console.warn
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      originalLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev.slice(-99), {
        timestamp: new Date().toISOString(),
        level: 'info',
        message,
      }]);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      
      // Extract error details
      let message = '';
      let stack = '';
      
      args.forEach(arg => {
        if (arg instanceof Error) {
          message += arg.message + ' ';
          stack = arg.stack || '';
        } else if (typeof arg === 'object') {
          message += JSON.stringify(arg, null, 2) + ' ';
        } else {
          message += String(arg) + ' ';
        }
      });
      
      setLogs(prev => [...prev.slice(-99), {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: message.trim(),
        stack,
      }]);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev.slice(-99), {
        timestamp: new Date().toISOString(),
        level: 'warn',
        message,
      }]);
    };

    // Intercept unhandled errors
    const handleError = (event: ErrorEvent) => {
      setLogs(prev => [...prev.slice(-99), {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Unhandled Error: ${event.message}`,
        stack: event.error?.stack || `at ${event.filename}:${event.lineno}:${event.colno}`,
      }]);
    };

    // Intercept unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      setLogs(prev => [...prev.slice(-99), {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack || '',
      }]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  const copyLogs = () => {
    const systemInfoText = systemInfo ? `
=== SYSTEM INFO ===
Platform: ${systemInfo.platform}
OS Version: ${systemInfo.osVersion}
Model: ${systemInfo.model}
Manufacturer: ${systemInfo.manufacturer}
App Version: ${systemInfo.appVersion}
Is Native: ${systemInfo.isNative}
Network: ${systemInfo.networkStatus} (${systemInfo.networkType})

=== USER INFO ===
User ID: ${user?.id || 'Not logged in'}
User Name: ${user?.name || 'Unknown'}
User Role: ${user?.role || 'Unknown'}

=== PERMISSIONS ===
Notification: ${permissions.notification}
Location: ${permissions.location}
Camera: ${permissions.camera}

=== LOGS ===
` : '';

    const logsText = logs.map(log => {
      let entry = `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`;
      if (log.stack) {
        entry += `\nStack: ${log.stack}`;
      }
      return entry;
    }).join('\n\n');
    
    navigator.clipboard.writeText(systemInfoText + logsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {/* Floating Debug Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 bg-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all border-4 border-white"
      >
        <Bug className="h-6 w-6" />
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[95] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Bug className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-gray-900">Debug Console</h3>
                  <p className="text-xs text-gray-500 font-medium">{logs.length} log entries</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-4 border-b border-gray-100">
              <button
                onClick={() => setShowSystemInfo(!showSystemInfo)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors"
              >
                <Smartphone className="h-4 w-4" />
                System Info
              </button>
              <button
                onClick={clearLogs}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
              <button
                onClick={copyLogs}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy All
                  </>
                )}
              </button>
            </div>

            {/* System Info Panel */}
            {showSystemInfo && systemInfo && (
              <div className="p-4 bg-purple-50 border-b border-purple-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-bold text-purple-900">Device</span>
                    </div>
                    <p className="text-xs text-gray-700 font-mono">{systemInfo.manufacturer} {systemInfo.model}</p>
                    <p className="text-xs text-gray-500 font-mono">{systemInfo.platform} {systemInfo.osVersion}</p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Wifi className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-bold text-purple-900">Network</span>
                    </div>
                    <p className="text-xs text-gray-700 font-mono">{systemInfo.networkStatus}</p>
                    <p className="text-xs text-gray-500 font-mono">{systemInfo.networkType}</p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-bold text-purple-900">User</span>
                    </div>
                    <p className="text-xs text-gray-700 font-mono truncate">{user?.name || 'Not logged in'}</p>
                    <p className="text-xs text-gray-500 font-mono">{user?.role || 'Unknown'}</p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-bold text-purple-900">Permissions</span>
                    </div>
                    <p className="text-xs text-gray-700 font-mono">
                      🔔 {permissions.notification === 'granted' ? '✅' : '❌'}
                      📍 {permissions.location === 'granted' ? '✅' : '❌'}
                      📷 {permissions.camera === 'granted' ? '✅' : '❌'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Logs */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bug className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-bold">No logs yet</p>
                  <p className="text-[10px] mt-1">Console logs will appear here</p>
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-xl border",
                      log.level === 'error' && "bg-red-50 border-red-200 text-red-900",
                      log.level === 'warn' && "bg-yellow-50 border-yellow-200 text-yellow-900",
                      log.level === 'info' && "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        log.level === 'error' && "bg-red-200 text-red-800",
                        log.level === 'warn' && "bg-yellow-200 text-yellow-800",
                        log.level === 'info' && "bg-gray-200 text-gray-800"
                      )}>
                        {log.level}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                      {log.message}
                    </pre>
                    {log.stack && (
                      <details className="mt-2">
                        <summary className="text-[10px] font-bold cursor-pointer hover:underline">
                          Stack Trace
                        </summary>
                        <pre className="mt-1 text-[10px] text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
                          {log.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
