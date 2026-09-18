import { useState, useEffect } from 'react';
import { Settings, User, Mail, LogOut, Shield, Check, AlertCircle, Camera, Loader2, Sun, Moon, Palette, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { initials } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { Link } from 'react-router-dom';

export function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isSupported, isSubscribed, subscribeUser, unsubscribeUser, loading: pushLoading } = usePushNotifications();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // PIN lock states
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('security_pin');
    setPinEnabled(!!saved);
  }, []);

  const handleTogglePin = async () => {
    if (pinEnabled) {
      if (profile) {
        await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ pin_enabled: false }) });
        await refreshProfile();
      }
      localStorage.removeItem('security_pin');
      setPinEnabled(false);
      window.dispatchEvent(new Event('security_pin_changed'));
      showToast('Security PIN disabled', 'success');
    } else {
      setPinInput('');
      setIsPinSetupOpen(true);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
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
    window.dispatchEvent(new Event('security_pin_changed'));
    showToast('6-digit Security PIN saved successfully', 'success');
  };

  // Initialize input values when profile loads
  useEffect(() => {
    if (profile && !isInitialized) {
      setFullName(profile.full_name || '');
      setIsInitialized(true);
    }
  }, [profile, isInitialized]);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    setStatus(null);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Image size must be less than 2MB');
      }

      const fileExt = (file.name.split('.').pop() || '').toLowerCase();
      if (['heic', 'heif'].includes(fileExt)) {
        throw new Error('HEIC/HEIF formats are not supported by web browsers. Please upload a JPEG or PNG image.');
      }

      const filePath = `${profile.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

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
    }
  };

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed out', 'info');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your profile, preferences, and theme" icon={Settings} />

      {/* User Info Header Card */}
      <div className="card p-6 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-slate-900/50 dark:to-slate-900/30 border border-indigo-100/50 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group h-20 w-20 shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                className="h-20 w-20 rounded-2xl object-cover shadow-md border-2 border-white dark:border-slate-800 transition-all group-hover:brightness-90"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-2xl font-bold text-white shadow-md">
                {initials(profile?.full_name)}
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading || !profile}
              />
            </label>
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{profile?.full_name || 'User'}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{profile?.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
              {profile?.is_admin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
                  <Shield className="h-3. w-3." /> Administrator
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Details Card */}
        <div className="card p-6 flex flex-col justify-between border border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="mb-4 section-title flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Profile Details
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Update your account information and contact name.</p>
            
            {status && (
              <div className={`mb-4 flex items-center gap-2 rounded-xl border p-3 text-sm ${
                status.type === 'success' ? 'border-success-200 bg-success-50 text-success-700 dark:bg-success-950/20 dark:text-success-400 dark:border-success-900' : 'border-error-200 bg-error-50 text-error-700 dark:bg-error-950/20 dark:text-error-400 dark:border-error-900'
              }`}>
                {status.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {status.msg}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="label text-slate-700 dark:text-slate-300">Full Name</label>
                <div className="relative mt-1">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-10 bg-white dark:bg-slate-900 dark:border-slate-800" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
              </div>
              <div>
                <label className="label text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-10 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-800 text-slate-500" value={profile?.email ?? ''} disabled />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8">
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto px-6 py-2.5">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Preferences / Theme Card */}
        <div className="card p-6 flex flex-col justify-between border border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="mb-4 section-title flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Palette className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Preferences
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Customize the interface appearance and active display mode.</p>
            
            <div className="space-y-4">
              <div>
                <label className="label text-slate-700 dark:text-slate-300">Theme Selection</label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      theme === 'light'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Sun className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-sm">Light Mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      theme === 'dark'
                        ? 'border-indigo-500 bg-indigo-950/30 text-indigo-400 border-indigo-600'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-indigo-950/50 text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Moon className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-sm">Dark Mode</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                <label className="label text-slate-700 dark:text-slate-300">Mobile Notifications</label>
                <div className="flex items-center justify-between mt-2 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Bill Reminders</p>
                      <p className="text-[10px] text-slate-450">Repeats every 15 min for unpaid bills</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {pushLoading ? 'Syncing...' : isSubscribed ? 'Active' : 'Disabled'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        disabled={!isSupported || pushLoading}
                        checked={isSubscribed}
                        onChange={isSubscribed ? unsubscribeUser : subscribeUser}
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                <label className="label text-slate-700 dark:text-slate-300">Security PIN Lock</label>
                <div className="flex flex-col gap-3 mt-2 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Device Lock</p>
                        <p className="text-[10px] text-slate-450">Require 6-digit PIN on app startup</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3.5">
                      {pinEnabled && (
                        <button
                          type="button"
                          onClick={() => { setPinInput(''); setIsPinSetupOpen(true); }}
                          className="px-2.5 py-1 text-[10px] font-bold text-indigo-650 hover:text-indigo-750 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                          Change/Reset
                        </button>
                      )}
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={pinEnabled}
                          onChange={handleTogglePin}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  {isPinSetupOpen && (
                    <form onSubmit={handleSavePin} className="border-t border-slate-200 dark:border-slate-800/80 pt-3 mt-1 flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Set 6-Digit PIN:</label>
                        <input
                          type="password"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="e.g. 123456"
                          className="input text-xs tracking-widest text-center"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Save PIN
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Actions and Log Out */}
      <div className="card divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800">
        {profile?.is_admin && (
          <Link to="/admin" className="flex items-center gap-3 p-6 transition hover:bg-slate-50 dark:hover:bg-slate-900/50">
            <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="flex-1 font-medium text-slate-900 dark:text-slate-100">Admin Panel</span>
            <span className="text-slate-400">→</span>
          </Link>
        )}
        <button onClick={handleSignOut} className="flex w-full items-center gap-3 p-6 transition hover:bg-error-50 dark:hover:bg-error-950/10">
          <LogOut className="h-5 w-5 text-error-600 dark:text-error-400" />
          <span className="flex-1 text-left font-medium text-error-600 dark:text-error-400">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
