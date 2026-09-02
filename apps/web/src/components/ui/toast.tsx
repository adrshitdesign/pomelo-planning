import * as React from 'react';
import { cn } from '@/lib/utils';

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error' | 'success';
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  push: (message: string, options?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;
}

const ToastContext = React.createContext<ToastContextValue>({ push: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback<ToastContextValue['push']>((message, options) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone: options?.tone ?? 'default', action: options?.action }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-md border px-3 py-2 text-sm animate-fade-in',
              toast.tone === 'error'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : toast.tone === 'success'
                  ? 'border-success/30 bg-success/10 text-foreground'
                  : 'border-border bg-surface',
            )}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  toast.action?.onClick();
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
