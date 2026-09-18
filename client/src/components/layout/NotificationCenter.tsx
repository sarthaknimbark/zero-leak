import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { api, isApiEnabled } from '@/lib/api';
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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    fetchNotifications();

    // Setup realtime subscription for notifications
    const channel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!profile) return;
    if (isApiEnabled()) {
      try {
        const data = await api<AppNotification[]>('/api/notifications');
        setNotifications(data);
      } catch (e) {
        console.error(e);
      }
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data as AppNotification[]);
    }
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    if (isApiEnabled()) {
      await api('/api/notifications/mark-all-read', { method: 'PATCH' });
      fetchNotifications();
      return;
    }
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false);

    if (!error) {
      fetchNotifications();
    }
  };

  const markAsRead = async (id: string) => {
    if (isApiEnabled()) {
      await api(`/api/notifications/${id}/read`, { method: 'PATCH' });
      fetchNotifications();
      return;
    }
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (!error) {
      fetchNotifications();
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isApiEnabled()) {
      await api(`/api/notifications/${id}`, { method: 'DELETE' });
      fetchNotifications();
      return;
    }
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchNotifications();
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 transition active:scale-95"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-xl z-55 max-h-[480px] flex flex-col">
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
        </div>
      )}
    </div>
  );
}
