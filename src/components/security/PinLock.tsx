import { useState, useEffect } from 'react';
import { Shield, Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PinLockProps {
  children: React.ReactNode;
}

export function PinLock({ children }: PinLockProps) {
  const [pin, setPin] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);

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

  const handleKeyPress = (num: string) => {
    const requiredLength = savedPin?.length || 6;
    if (pin.length >= requiredLength) return;
    const nextPin = pin + num;
    setPin(nextPin);

    if (nextPin.length === requiredLength) {
      if (nextPin === savedPin) {
        setTimeout(() => {
          setIsLocked(false);
          setPin('');
        }, 150);
      } else {
        setTimeout(() => {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setPin('');
        }, 100);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  const buttons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'delete'];

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-white select-none transition-colors duration-250"
      style={{
        background: 'radial-gradient(circle at 50% 25%, rgba(159, 18, 57, 0.35) 0%, rgba(15, 23, 42, 0.98) 75%)'
      }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-xs px-4 flex flex-col items-center justify-between h-[85vh] py-8"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-4">
          <motion.div 
            animate={{ 
              scale: [1, 1.03, 1],
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 5, 
              ease: 'easeInOut' 
            }}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-lg text-white relative"
          >
            {/* Pulsing halo */}
            <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping opacity-45" />
            <Shield className="h-10 w-10 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.55)]" />
          </motion.div>
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-semibold tracking-wide text-white/95">Zero Leak</h1>
            <p className="text-[10px] font-bold text-white/60 tracking-[0.25em] uppercase pl-[0.25em]">Enter Passcode</p>
          </div>
        </div>

        {/* PIN Indicators */}
        <div className="flex flex-col items-center gap-2 w-full my-auto py-6">
          <motion.div
            animate={shake ? { x: [-12, 12, -12, 12, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="flex gap-5 justify-center py-2"
          >
            {Array.from({ length: savedPin?.length || 6 }).map((_, index) => {
              const hasValue = pin.length > index;
              return (
                <motion.div
                  key={index}
                  animate={hasValue ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`h-3 w-3 rounded-full border transition-all duration-150 ${
                    hasValue
                      ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/50'
                      : 'border-white/30 bg-transparent'
                  }`}
                />
              );
            })}
          </motion.div>

          {/* Warning text space */}
          <div className="h-4">
            <AnimatePresence>
              {shake && (
                <motion.span 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] font-bold text-rose-500"
                >
                  Incorrect PIN. Please try again.
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Circular Keypad Grid */}
        <div className="grid grid-cols-3 gap-y-5 gap-x-8 justify-items-center w-full max-w-[280px] shrink-0 pb-4">
          {buttons.map((btn, index) => {
            if (btn === 'C') {
              return (
                <motion.button
                  key={btn}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleClear}
                  className="flex items-center justify-center h-20 w-20 shrink-0 rounded-full text-xs font-semibold text-white/50 hover:text-white transition-colors"
                >
                  Clear
                </motion.button>
              );
            }
            if (btn === 'delete') {
              return (
                <motion.button
                  key={btn}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleBackspace}
                  className="flex items-center justify-center h-20 w-20 shrink-0 rounded-full text-white/50 hover:text-white transition-colors"
                >
                  <Delete className="h-5 w-5" />
                </motion.button>
              );
            }
            return (
              <motion.button
                key={btn}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.015, duration: 0.2 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => handleKeyPress(btn)}
                className="flex items-center justify-center h-20 w-20 shrink-0 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-3xl font-light text-white shadow-sm transition-colors duration-150"
              >
                {btn}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
