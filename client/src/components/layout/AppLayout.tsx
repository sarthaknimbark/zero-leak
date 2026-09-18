import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, TrendingUp, Search,
  Tags, Download, Settings, LogOut, Plus, Menu, X,
  PiggyBank, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft,
  Shield, ChevronLeft, Sun, Moon, CalendarDays, ShieldAlert, Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { NotificationCenter } from './NotificationCenter';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageSpinner } from '@/components/ui/Skeleton';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const mainNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: TrendingUp },
  { to: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/savings', label: 'Saving Goals', icon: PiggyBank },
];

const moreNav: NavItem[] = [
  { to: '/bills', label: 'Bills & Reminders', icon: CalendarDays },
  { to: '/debts', label: 'Debt Tracker', icon: Users },
  { to: '/leaks', label: 'Leak Detector', icon: ShieldAlert },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/export', label: 'Export & Backup', icon: Download },
  { to: '/profile', label: 'Settings', icon: Settings },
];

const fabActions = [
  { label: 'New Transaction', icon: ArrowDownCircle, path: '/transactions?action=new' },
  { label: 'New Transfer', icon: ArrowRightLeft, path: '/transfers?action=new' },
  { label: 'Add Account', icon: PiggyBank, path: '/accounts?action=new' },
];

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!profile) {
    return <PageSpinner />;
  }

  const allNav = [...mainNav, ...moreNav];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-250">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:flex lg:flex-col">
        <SidebarContent profile={profile} onSignOut={signOut} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white dark:bg-slate-900 lg:hidden"
            >
              <button
                className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent profile={profile} onSignOut={signOut} onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" className="h-8 w-8 rounded-lg object-cover shadow-sm" alt="Zero Leak Logo" />
            <span className="font-bold text-slate-900 dark:text-slate-100">Zero Leak</span>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationCenter />
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="h-8 w-8 rounded-full object-cover border border-slate-200/40 shadow-sm" alt="Profile" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {initials(profile?.full_name)}
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-36 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {location.key !== 'default' && (
            <button
              onClick={() => navigate(-1)}
              className="mb-4 hidden items-center gap-1 text-sm text-slate-500 hover:text-slate-700 lg:flex"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* FAB */}
      <div className="fixed bottom-24 right-4 z-30 lg:bottom-8 lg:right-8">
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-16 right-0 flex flex-col gap-2"
            >
              {fabActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => { navigate(action.path); setFabOpen(false); }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-float transition hover:bg-slate-50"
                >
                  {action.label}
                  <action.icon className="h-4 w-4 text-indigo-600" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-float shadow-indigo-600/30 transition-all active:scale-95"
        >
          <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
            <Plus className="h-6 w-6" />
          </motion.div>
        </button>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-4 left-4 right-4 z-30 rounded-2xl border border-slate-200/80 dark:border-slate-800/85 bg-white/95 dark:bg-slate-900/95 shadow-xl shadow-slate-200/50 dark:shadow-none backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {mainNav.slice(0, 4).map((item) => (
            <BottomNavLink key={item.to} item={item} />
          ))}
          <NavLink
            to="/analytics"
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-all duration-300',
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              )
            }
          >
            {({ isActive }) => (
              <>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  animate={isActive ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <TrendingUp className="h-5 w-5" />
                </motion.div>
                <span>More</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

function BottomNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex-1 flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-all duration-300',
          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
        )
      }
    >
      {({ isActive }) => (
        <>
          <motion.div
            whileTap={{ scale: 0.9 }}
            animate={isActive ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <item.icon className="h-5 w-5" />
          </motion.div>
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({
  profile,
  onSignOut,
  onNavigate,
}: {
  profile: { full_name: string | null; email: string; is_admin: boolean; avatar_url: string | null } | null;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100 dark:border-slate-800/40">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" className="h-9 w-9 rounded-xl object-cover shadow-md" alt="Zero Leak Logo" />
          <div>
            <p className="font-bold tracking-tight text-slate-900 dark:text-slate-100">Zero Leak</p>
            <p className="text-xs text-slate-400">Money Management</p>
          </div>
        </div>
        <div className="hidden lg:block">
          <NotificationCenter />
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Menu</p>
        {mainNav.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={onNavigate} />
        ))}
        <p className="px-3 py-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">More</p>
        {moreNav.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={onNavigate} />
        ))}
        {profile?.is_admin && (
          <>
            <p className="px-3 py-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Admin</p>
            <SidebarLink item={{ to: '/admin', label: 'Admin Panel', icon: Shield }} onClick={onNavigate} />
          </>
        )}
      </nav>

      <div className="border-t border-slate-100 dark:border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="h-9 w-9 rounded-full object-cover border border-slate-200/40 shadow-sm" alt="Avatar" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {initials(profile?.full_name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{profile?.full_name || 'User'}</p>
            <p className="truncate text-xs text-slate-400">{profile?.email || ''}</p>
          </div>
          <button onClick={onSignOut} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-error-600" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
          isActive
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
        )
      }
    >
      <item.icon className="h-5 w-5" />
      {item.label}
    </NavLink>
  );
}
