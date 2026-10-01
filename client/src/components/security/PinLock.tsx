import { useState, useEffect } from 'react';
import { Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PinLockProps {
  children: React.ReactNode;
}

export function PinLock({ children }: PinLockProps) {
  const [pin, setPin] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const storedPin = localStorage.getItem('security_pin');
    setSavedPin(storedPin);
    setIsLocked(!!storedPin);
  }, []);

  useEffect(() => {
    const handlePinChange = () => {
      const storedPin = localStorage.getItem('security_pin');
      setSavedPin(storedPin);
      setIsLocked(!!storedPin);
    };
    window.addEventListener('security_pin_changed', handlePinChange);
    return () => window.removeEventListener('security_pin_changed', handlePinChange);
  }, []);

  useEffect(() => {
    if (!isLocked) return;
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [isLocked]);

  const requiredLength = savedPin?.length || 6;

  const submitIfComplete = (nextPin: string) => {
    if (nextPin.length !== requiredLength) return;
    if (nextPin === savedPin) {
      window.setTimeout(() => {
        setIsLocked(false);
        setPin('');
      }, 120);
      return;
    }
    window.setTimeout(() => {
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      setPin('');
    }, 80);
  };

  const handleKeyPress = (num: string) => {
    if (pin.length >= requiredLength) return;
    const nextPin = pin + num;
    setPin(nextPin);
    submitIfComplete(nextPin);
  };

  const handleBackspace = () => {
    setPin((current) => current.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  const buttons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'delete'];
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#070b14] text-white select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(99,102,241,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex w-full max-w-sm flex-col items-center px-6 py-8"
      >
        <div className="mb-8 text-center">
          <p className="font-display text-5xl font-semibold tracking-tight tabular-nums text-white">{time}</p>
          <p className="mt-1 text-sm text-white/55">{date}</p>
        </div>

        <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.06] px-6 py-7 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="mb-6 flex flex-col items-center text-center">
            <img src="/favicon.svg" alt="" className="mb-3 h-11 w-11 rounded-2xl" />
            <p className="text-sm font-semibold tracking-wide">Zero Leak</p>
            <p className="mt-1 text-xs text-white/50">Enter your PIN to continue</p>
          </div>

          <motion.div
            animate={shake ? { x: [-10, 10, -8, 8, -3, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.38 }}
            className="mb-2 flex justify-center gap-3"
          >
            {Array.from({ length: requiredLength }).map((_, index) => {
              const filled = pin.length > index;
              return (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    filled ? 'bg-white' : 'bg-white/20'
                  }`}
                />
              );
            })}
          </motion.div>

          <div className="mb-5 h-5 text-center">
            <AnimatePresence>
              {shake && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-rose-300"
                >
                  Incorrect PIN. Try again.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-3">
            {buttons.map((btn) => {
              if (btn === 'C') {
                return (
                  <button
                    key={btn}
                    type="button"
                    onClick={handleClear}
                    className="flex h-16 items-center justify-center rounded-2xl text-xs font-medium text-white/45 transition hover:bg-white/5 hover:text-white/80"
                  >
                    Clear
                  </button>
                );
              }
              if (btn === 'delete') {
                return (
                  <button
                    key={btn}
                    type="button"
                    onClick={handleBackspace}
                    aria-label="Delete"
                    className="flex h-16 items-center justify-center rounded-2xl text-white/55 transition hover:bg-white/5 hover:text-white"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                );
              }
              return (
                <button
                  key={btn}
                  type="button"
                  onClick={() => handleKeyPress(btn)}
                  className="flex h-16 items-center justify-center rounded-2xl bg-white/[0.07] text-2xl font-medium text-white ring-1 ring-white/10 transition hover:bg-white/[0.12] active:scale-[0.97]"
                >
                  {btn}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
