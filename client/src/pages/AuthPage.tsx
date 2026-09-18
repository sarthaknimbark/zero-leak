import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';

const schema = z.object({
  fullName: z.string().min(2, 'Enter your name').optional().or(z.literal('')),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Min 6 characters'),
});

type FormData = z.infer<typeof schema>;

export function AuthPage() {
  const { signIn, signUp, session } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setServerSuccess(null);
    setSubmitting(true);
    if (mode === 'login') {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        setServerError(error);
        showToast(error, 'error');
      } else {
        showToast('Welcome back!', 'success');
        navigate('/');
      }
    } else {
      const { error } = await signUp(data.email, data.password, data.fullName || '');
      if (error) {
        setServerError(error);
        showToast(error, 'error');
      } else {
        setServerSuccess('Account created! You can sign in now.');
        showToast('Account created successfully', 'success');
        setMode('login');
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="app-shell-bg relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="card border-slate-200/80 p-8 shadow-glow dark:border-slate-700/50 sm:p-10"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 18 }}
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-indigo-600/15"
            >
              <img src="/favicon.svg" className="h-14 w-14 rounded-2xl object-cover" alt="Zero Leak" />
            </motion.div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Zero Leak
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {mode === 'login' ? 'Welcome back. Sign in to continue.' : 'Create your account to get started.'}
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/60">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setServerError(null); setServerSuccess(null); }}
                className={`relative rounded-lg py-2 text-sm font-semibold transition ${
                  mode === m ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-lg bg-white shadow-soft dark:bg-slate-900"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{m === 'login' ? 'Sign in' : 'Sign up'}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {serverSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 flex items-start gap-2 rounded-xl border border-success-200 bg-success-50 p-3.5 text-sm text-success-700 dark:border-success-900/40 dark:bg-success-950/30 dark:text-success-300"
              >
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverSuccess}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-3.5 text-sm text-error-700 dark:border-error-900/40 dark:bg-error-950/30 dark:text-error-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  key="fullname"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pb-4">
                    <label className="label" htmlFor="fullName">Full name</label>
                    <input id="fullName" className="input" placeholder="Alex Morgan" autoComplete="name" {...register('fullName')} />
                    {errors.fullName && <p className="mt-1 text-xs text-error-600">{errors.fullName.message}</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" placeholder="you@example.com" autoComplete="email" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-error-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="input" placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-error-600">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Every movement of money, tracked.
        </p>
      </div>
    </div>
  );
}
