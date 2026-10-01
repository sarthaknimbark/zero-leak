import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
}

export function NotificationCenter() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; right: number }>({ top: 56, right: 12 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const placePanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanelStyle({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  };

  useEffect(() => {
    if (!profile) return;
    void fetchNotifications();
    const timer = window.setInterval(() => {
      void fetchNotifications();
    }, 60_000);

    const channel = supabase
      .channel(`notifications_${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => {
          void fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!profile) return;
    try {
      const data = await api<AppNotification[]>('/api/notifications');
      setNotifications(data);
      setLoadError(null);
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Could not load notifications');
    }
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    await api('/api/notifications/mark-all-read', { method: 'PATCH' });
    fetchNotifications();
  };

  const markAsRead = async (id: string) => {
    await api(`/api/notifications/${id}/read`, { method: 'PATCH' });
    fetchNotifications();
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api(`/api/notifications/${id}`, { method: 'DELETE' });
    fetchNotifications();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      {/* Bell Trigger Icon */}
      <button
        ref={buttonRef}
        onClick={() => {
          placePanel();
          setIsOpen((open) => !open);
        }}
        className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-800"
        title="Notifications"
        aria-expanded={isOpen}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
        <div
          ref={dropdownRef}
          style={{ top: panelStyle.top, right: panelStyle.right }}
          className="fixed z-[80] flex max-h-[480px] w-[min(24rem,calc(100vw-1.5rem))] flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-xl dark:border-slate-800/80 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-[9px] font-extrabold text-indigo-650 dark:text-indigo-400 border border-indigo-100/30">
                  {unreadCount} New
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-650 hover:text-indigo-700 dark:text-indigo-400"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
            {loadError && (
              <p className="mb-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
                {loadError}
              </p>
            )}
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-950/20 text-slate-400 rounded-full mb-3">
                  <Bell className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-350">No notifications yet</p>
                <p className="text-[10px] text-slate-450 mt-1 max-w-[200px]">You will see alerts here when bills or debts are due.</p>
              </div>
            ) : (
              notifications.map(item => (
                <div
                  key={item.id}
                  onClick={() => !item.read && markAsRead(item.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative group flex items-start gap-3 ${
                    item.read
                      ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/30'
                      : 'bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-100/20 dark:border-indigo-900/10 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20'
                  }`}
                >
                  {/* Indicator dot */}
                  {!item.read && (
                    <span className="absolute top-3.5 left-2 h-1.5 w-1.5 rounded-full bg-indigo-600" />
                  )}

                  <div className="flex-1 min-w-0 pl-1.5">
                    <p className={`text-xs text-slate-850 dark:text-slate-150 ${item.read ? 'font-medium' : 'font-bold'}`}>
                      {item.title}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-relaxed mt-0.5 break-words">
                      {item.body}
                    </p>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block font-medium">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(e) => deleteNotification(item.id, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
