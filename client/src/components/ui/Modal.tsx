import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const maxWidth = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  const modalVariants = {
    initial: isMobile 
      ? { y: '100%', opacity: 1, scale: 1 } 
      : { y: 0, opacity: 0, scale: 0.95 },
    animate: { y: 0, opacity: 1, scale: 1 },
    exit: isMobile 
      ? { y: '100%', opacity: 1, scale: 1 } 
      : { y: 0, opacity: 0, scale: 0.95 }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-t-3xl border border-slate-200/70 bg-white shadow-float dark:border-slate-700/60 dark:bg-slate-900 sm:rounded-2xl`}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
