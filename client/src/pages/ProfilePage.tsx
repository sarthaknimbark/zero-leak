import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Settings,
  User,
  Mail,
  LogOut,
  Shield,
  Check,
  AlertCircle,
  Camera,
  Loader2,
  Sun,
  Moon,
  Palette,
  Bell,
  Lock,
  Fingerprint,
  Sparkles,
  ChevronRight,
  Delete,
  Upload,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/PageHeader';

type TabId = 'profile' | 'preferences' | 'security';

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
];

const panelMotion = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
};

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-indigo-600 shadow-[0_0_16px_-2px_rgba(79,70,229,0.55)]' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md"
        animate={{ x: checked ? 20 : 0 }}
      >
        {checked && <Check className="h-3 w-3 text-indigo-600" strokeWidth={3} />}
      </motion.span>
    </button>
  );
}

function PinKeypad({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

  const press = (key: (typeof keys)[number]) => {
    if (key === '') return;
    if (key === 'del') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= 6) return;
    const next = value + key;
    onChange(next);
    if (next.length === 6) {
      // slight delay so the 6th digit renders before submit
      window.setTimeout(() => onSubmit(), 120);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-4 rounded-2xl border border-indigo-100/80 bg-gradient-to-b from-indigo-50/80 to-white p-4 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-slate-900/40">
        <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Enter 6-digit PIN
        </p>
        <div className="mb-4 flex justify-center gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: value.length === i ? 1.15 : 1,
                borderColor:
                  value.length > i
                    ? 'rgb(79 70 229)'
                    : value.length === i
                      ? 'rgb(129 140 248)'
                      : undefined,
              }}
              className={cn(
                'flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 transition-colors',
                value.length > i
                  ? 'border-indigo-600 bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]'
                  : 'border-slate-300 dark:border-slate-600',
              )}
            />
          ))}
        </div>
        <div className="mx-auto grid max-w-[240px] grid-cols-3 gap-2">
          {keys.map((key, i) =>
            key === '' ? (
              <div key={i} />
            ) : (
              <motion.button
                key={key + i}
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={() => press(key)}
                className={cn(
                  'flex h-12 items-center justify-center rounded-xl text-lg font-semibold transition-colors',
                  key === 'del'
                    ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                    : 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/80 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300',
                )}
              >
                {key === 'del' ? <Delete className="h-4 w-4" /> : key}
              </motion.button>
            ),
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost flex-1 text-xs">
            Cancel
          </button>
          <button
            type="button"
            disabled={value.length !== 6}
            onClick={onSubmit}
            className="btn-primary flex-1 text-xs disabled:opacity-40"
          >
            Save PIN
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isSupported, isSubscribed, subscribeUser, unsubscribeUser, loading: pushLoading } =
    usePushNotifications();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabId>('profile');
  const [fullName, setFullName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('security_pin');
    setPinEnabled(!!saved);
  }, []);

  useEffect(() => {
    if (profile && !isInitialized) {
      setFullName(profile.full_name || '');
      setIsInitialized(true);
    }
  }, [profile, isInitialized]);

  const dirty = isInitialized && fullName.trim() !== (profile?.full_name || '').trim();

  const securityScore = useMemo(() => {
    let score = 40;
    if (pinEnabled) score += 35;
    if (isSubscribed) score += 15;
    if (profile?.avatar_url) score += 10;
    return Math.min(100, score);
  }, [pinEnabled, isSubscribed, profile?.avatar_url]);

  const handleTogglePin = async () => {
    if (pinEnabled) {
      if (profile) {
        await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ pin_enabled: false }) });
        await refreshProfile();
      }
      localStorage.removeItem('security_pin');
      setPinEnabled(false);
      setIsPinSetupOpen(false);
      window.dispatchEvent(new Event('security_pin_changed'));
      showToast('Security PIN disabled', 'success');
    } else {
      setPinInput('');
      setIsPinSetupOpen(true);
    }
  };

  const handleSavePin = async () => {
    if (pinInput.length !== 6 || isNaN(Number(pinInput))) {
      showToast('PIN must be a 6-digit number', 'error');
      return;
    }
    if (profile) {
      await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ pin_enabled: true }) });
      await refreshProfile();
    }
    localStorage.setItem('security_pin', pinInput);
    setPinEnabled(true);
    setIsPinSetupOpen(false);
    setPinInput('');
    window.dispatchEvent(new Event('security_pin_changed'));
    showToast('6-digit Security PIN saved successfully', 'success');
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setStatus(null);
    try {
      await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ full_name: fullName }) });
      await refreshProfile();
      showToast('Profile updated', 'success');
      setStatus({ type: 'success', msg: 'Profile updated successfully' });
    } catch (err) {
      const msg = (err as Error).message || 'Failed to update profile';
      showToast(msg, 'error');
      setStatus({ type: 'error', msg });
    }
    setSaving(false);
  };

  const uploadAvatarFile = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    setStatus(null);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Please select an image file');
      if (file.size > 2 * 1024 * 1024) throw new Error('Image size must be less than 2MB');

      const fileExt = (file.name.split('.').pop() || '').toLowerCase();
      if (['heic', 'heif'].includes(fileExt)) {
        throw new Error('HEIC/HEIF formats are not supported. Please upload JPEG or PNG.');
      }

      const filePath = `${profile.id}/avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      await api('/api/profile/avatar', {
        method: 'POST',
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      await refreshProfile();
      showToast('Avatar updated', 'success');
      setStatus({ type: 'success', msg: 'Avatar updated successfully' });
    } catch (err) {
      const msg = (err as Error).message || 'Failed to upload avatar';
      showToast(msg, 'error');
      setStatus({ type: 'error', msg });
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadAvatarFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadAvatarFile(file);
  };

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed out', 'info');
  };

  const handlePushToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribeUser();
      showToast(ok ? 'Notifications disabled' : 'Could not disable notifications', ok ? 'success' : 'error');
    } else {
      const ok = await subscribeUser();
      showToast(ok ? 'Bill reminders enabled' : 'Could not enable notifications', ok ? 'success' : 'error');
    }
  };

  const displayName = fullName.trim() || profile?.full_name || 'Your name';
  const circumference = 2 * Math.PI * 44;
  const strokeOffset = circumference - (securityScore / 100) * circumference;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        subtitle="Identity, preferences, and device security"
        icon={Settings}
      />

      {/* Interactive identity hero */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl border border-indigo-100/70 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-6 text-white shadow-glow dark:border-indigo-900/40 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          {/* Avatar + security ring */}
          <div
            className="group relative"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <svg className="-rotate-90" width="112" height="112" viewBox="0 0 112 112">
              <circle cx="56" cy="56" r="44" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
              <motion.circle
                cx="56"
                cy="56"
                r="44"
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: strokeOffset }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !profile}
              className={cn(
                'absolute inset-2 overflow-hidden rounded-full ring-2 ring-white/40 transition-transform duration-300 group-hover:scale-[1.03]',
                dragOver && 'ring-4 ring-white scale-105',
              )}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/20 text-2xl font-bold backdrop-blur-sm">
                  {initials(displayName)}
                </div>
              )}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Change</span>
                  </>
                )}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading || !profile}
            />
            <motion.div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 shadow-md"
              animate={{ y: [0, -2, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            >
              {securityScore}% secure
            </motion.div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              Live preview
            </div>
            <AnimatePresence mode="wait">
              <motion.h2
                key={displayName}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
              >
                {displayName}
              </motion.h2>
            </AnimatePresence>
            <p className="mt-1 truncate text-sm text-indigo-100/90">{profile?.email}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {profile?.is_admin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
                  <Shield className="h-3 w-3" /> Administrator
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                <Lock className="h-3 w-3" />
                PIN {pinEnabled ? 'on' : 'off'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                <Bell className="h-3 w-3" />
                Alerts {isSubscribed ? 'on' : 'off'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="hidden shrink-0 items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold backdrop-blur-md transition hover:bg-white/25 sm:inline-flex"
          >
            <Upload className="h-4 w-4" />
            Drop or upload
          </button>
        </div>
      </motion.section>

      {/* Tab rail */}
      <div className="relative flex gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/60">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'relative z-10 flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              {active && (
                <motion.span
                  layoutId="profile-tab"
                  className="absolute inset-0 rounded-xl bg-white shadow-soft dark:bg-slate-800"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
              <Icon className="relative h-4 w-4" />
              <span className="relative hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'profile' && (
          <motion.div key="profile" {...panelMotion} className="card space-y-5 p-6">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Profile details
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Edit your display name — the hero updates as you type.
              </p>
            </div>

            {status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-3 text-sm',
                  status.type === 'success'
                    ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-900 dark:bg-success-950/20 dark:text-success-400'
                    : 'border-error-200 bg-error-50 text-error-700 dark:border-error-900 dark:bg-error-950/20 dark:text-error-400',
                )}
              >
                {status.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {status.msg}
              </motion.div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <div className="relative mt-1">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-10"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    maxLength={80}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-400">
                    {fullName.length}/80
                  </span>
                </div>
              </div>
              <div>
                <label className="label">Email address</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input cursor-not-allowed bg-slate-50 pl-10 text-slate-500 dark:bg-slate-900/50"
                    value={profile?.email ?? ''}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving || !dirty}
                className="btn-primary px-6 disabled:opacity-40"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </span>
                ) : dirty ? (
                  'Save changes'
                ) : (
                  'Up to date'
                )}
              </motion.button>
              <AnimatePresence>
                {dirty && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-medium text-amber-600 dark:text-amber-400"
                  >
                    Unsaved changes
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {tab === 'preferences' && (
          <motion.div key="preferences" {...panelMotion} className="space-y-4">
            <div className="card p-6">
              <h2 className="section-title mb-1 flex items-center gap-2">
                <Palette className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Appearance
              </h2>
              <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
                Switch themes instantly — pick a mode that fits your focus.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: 'light' as const, label: 'Light', icon: Sun, preview: 'from-slate-100 to-white' },
                    { id: 'dark' as const, label: 'Dark', icon: Moon, preview: 'from-slate-900 to-slate-800' },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setTheme(opt.id)}
                      className={cn(
                        'relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-shadow',
                        active
                          ? 'border-indigo-600 shadow-glow'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                      )}
                    >
                      <div className={cn('mb-3 h-16 rounded-xl bg-gradient-to-br ring-1 ring-black/5', opt.preview)}>
                        <div className="flex h-full items-end gap-1 p-2">
                          <div className={cn('h-6 w-8 rounded', opt.id === 'light' ? 'bg-indigo-400' : 'bg-indigo-500')} />
                          <div className={cn('h-4 w-10 rounded', opt.id === 'light' ? 'bg-slate-300' : 'bg-slate-600')} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          <Icon className="h-4 w-4" />
                          {opt.label}
                        </span>
                        {active && (
                          <motion.span
                            layoutId="theme-check"
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </motion.span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Bill reminders</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Push alerts every 15 min for unpaid bills
                    </p>
                    {!isSupported && (
                      <p className="mt-1 text-xs text-amber-600">Not supported in this browser</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Toggle
                    checked={isSubscribed}
                    onChange={handlePushToggle}
                    disabled={!isSupported || pushLoading}
                    label="Toggle bill reminders"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {pushLoading ? 'Syncing…' : isSubscribed ? 'Active' : 'Off'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'security' && (
          <motion.div key="security" {...panelMotion} className="space-y-4">
            <div className="card overflow-hidden p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Device lock
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Require a 6-digit PIN when the app starts
                  </p>
                </div>
                <Toggle
                  checked={pinEnabled}
                  onChange={handleTogglePin}
                  label="Toggle security PIN"
                />
              </div>

              {/* Security meter */}
              <div className="mb-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Security posture</span>
                  <span className="tabular-nums text-indigo-600 dark:text-indigo-400">{securityScore}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${securityScore}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className={cn('h-3.5 w-3.5', pinEnabled ? 'text-success-500' : 'text-slate-300')} />
                    PIN lock {pinEnabled ? 'enabled' : 'disabled'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={cn('h-3.5 w-3.5', isSubscribed ? 'text-success-500' : 'text-slate-300')} />
                    Push alerts {isSubscribed ? 'on' : 'off'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={cn('h-3.5 w-3.5', profile?.avatar_url ? 'text-success-500' : 'text-slate-300')} />
                    Profile photo {profile?.avatar_url ? 'set' : 'missing'}
                  </li>
                </ul>
              </div>

              {pinEnabled && !isPinSetupOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setIsPinSetupOpen(true);
                  }}
                  className="btn-secondary w-full text-sm"
                >
                  Change / reset PIN
                </button>
              )}

              <AnimatePresence>
                {isPinSetupOpen && (
                  <PinKeypad
                    value={pinInput}
                    onChange={setPinInput}
                    onSubmit={handleSavePin}
                    onCancel={() => {
                      setIsPinSetupOpen(false);
                      setPinInput('');
                    }}
                  />
                )}
              </AnimatePresence>
            </div>

            {profile?.is_admin && (
              <Link
                to="/admin"
                className="card card-hover flex items-center gap-3 p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Admin panel</p>
                  <p className="text-xs text-slate-500">Manage users and system settings</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </Link>
            )}

            <div className="card overflow-hidden">
              {!confirmSignOut ? (
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(true)}
                  className="flex w-full items-center gap-3 p-5 transition hover:bg-error-50 dark:hover:bg-error-950/10"
                >
                  <LogOut className="h-5 w-5 text-error-600 dark:text-error-400" />
                  <span className="flex-1 text-left font-medium text-error-600 dark:text-error-400">
                    Sign out
                  </span>
                  <ChevronRight className="h-5 w-5 text-error-300" />
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"
                >
                  <p className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Sign out of Zero Leak on this device?
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmSignOut(false)} className="btn-secondary text-sm">
                      Cancel
                    </button>
                    <button type="button" onClick={handleSignOut} className="btn-danger text-sm">
                      Confirm sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
