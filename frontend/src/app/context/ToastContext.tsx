import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastItem } from '../components/shared/types';
import { generateId } from '../components/shared/utils';

interface ToastContextValue {
  showToast: (type: ToastItem['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const toastStyles: Record<ToastItem['type'], { bg: string; border: string; color: string; icon: ReactNode }> = {
    success: {
      bg: '#d1e7dd',
      border: '#a3cfbb',
      color: '#0f5132',
      icon: <CheckCircle size={18} />,
    },
    danger: {
      bg: '#f8d7da',
      border: '#f1aeb5',
      color: '#842029',
      icon: <XCircle size={18} />,
    },
    warning: {
      bg: '#fff3cd',
      border: '#ffe69c',
      color: '#664d03',
      icon: <AlertTriangle size={18} />,
    },
    info: {
      bg: '#cff4fc',
      border: '#9eeaf9',
      color: '#055160',
      icon: <Info size={18} />,
    },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="assertive"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 320,
        }}
      >
        {toasts.map((toast) => {
          const s = toastStyles[toast.type];
          return (
            <div
              key={toast.id}
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                animation: 'slideInRight 0.25s ease',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {s.icon}
              <span style={{ flex: 1 }}>{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: s.color,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  opacity: 0.7,
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
