import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 px-4 py-12">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="card p-8 sm:p-10"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-indigo-600/10">
              <img src="/favicon.svg" className="h-14 w-14 rounded-2xl object-cover" alt="Zero Leak Logo" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Zero Leak</h1>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login' ? 'Welcome back. Sign in to your account.' : 'Create your account to get started.'}
            </p>
          </div>

          {serverSuccess && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-success-200 bg-success-50 p-3.5 text-sm text-success-700">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverSuccess}</span>
            </div>
          )}

          {serverError && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-3.5 text-sm text-error-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  className="input"
                  placeholder="Alex Morgan"
                  {...register('fullName')}
                />
                {errors.fullName && <p className="mt-1 text-xs text-error-600">{errors.fullName.message}</p>}
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-error-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                {...register('password')}
              />
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

          <div className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                  onClick={() => { setMode('signup'); setServerError(null); setServerSuccess(null); }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                  onClick={() => { setMode('login'); setServerError(null); setServerSuccess(null); }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </motion.div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Zero Leak — Every movement of money, tracked.
        </p>
      </div>
    </div>
  );
}
