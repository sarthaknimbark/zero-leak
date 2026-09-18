import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success', action?: ToastAction) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, action ? 6000 : 3500); // Give action toasts more time to be clicked
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-24 right-4 z-[60] flex flex-col gap-2 lg:bottom-8">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-float ${
                toast.type === 'success'
                  ? 'border-success-200 bg-white text-success-700'
                  : toast.type === 'error'
                  ? 'border-error-200 bg-white text-error-700'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {toast.type === 'success' && <CheckCircle className="h-4 w-4 shrink-0 text-success-500" />}
              {toast.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-error-500" />}
              {toast.type === 'info' && <Info className="h-4 w-4 shrink-0 text-slate-400" />}
              <span className="flex-1">{toast.message}</span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className="ml-2 shrink-0 font-bold uppercase text-[11px] text-indigo-600 hover:text-indigo-800"
                >
                  {toast.action.label}
                </button>
              )}
              <button onClick={() => removeToast(toast.id)} className="text-slate-300 hover:text-slate-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
