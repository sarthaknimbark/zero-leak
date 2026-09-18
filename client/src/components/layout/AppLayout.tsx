import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, TrendingUp, Search,
  Tags, Download, Settings, LogOut, Plus, Menu, X,
  PiggyBank, ArrowDownCircle, ArrowRightLeft,
  Shield, ChevronLeft, Sun, Moon, CalendarDays, ShieldAlert, Users, Grid2X2,
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

const pageTransition = {
  initial: { opacity: 0, y: 10, filter: 'blur(2px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -4, filter: 'blur(2px)' },
};

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFabOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  if (!profile) {
    return <PageSpinner />;
  }

  return (
    <div className="app-shell-bg min-h-dvh transition-colors duration-300">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar backdrop-blur-xl lg:flex lg:flex-col">
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
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col border-r border-slate-200/80 bg-white shadow-float dark:border-slate-800 dark:bg-slate-950 lg:hidden"
            >
              <button
                className="absolute right-3 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent profile={profile} onSignOut={signOut} onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/75 px-4 py-3 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70 lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" className="h-8 w-8 rounded-lg object-cover shadow-sm" alt="Zero Leak" />
            <span className="font-display font-bold tracking-tight text-slate-900 dark:text-slate-100">Zero Leak</span>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationCenter />
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="h-8 w-8 rounded-full border border-slate-200/40 object-cover shadow-sm" alt="" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {initials(profile?.full_name)}
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-36 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {location.key !== 'default' && (
            <button
              onClick={() => navigate(-1)}
              className="mb-4 hidden items-center gap-1 rounded-lg px-1 py-0.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:inline-flex"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
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
            <>
              <motion.button
                type="button"
                aria-label="Close quick actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[-1] cursor-default bg-slate-950/10 backdrop-blur-[1px] lg:bg-transparent lg:backdrop-blur-0"
                onClick={() => setFabOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-16 right-0 flex w-52 flex-col gap-2"
              >
                {fabActions.map((action, i) => (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => { navigate(action.path); setFabOpen(false); }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-float transition hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40"
                  >
                    {action.label}
                    <action.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </motion.button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setFabOpen(!fabOpen)}
          aria-expanded={fabOpen}
          aria-label="Quick actions"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-glow transition-colors hover:bg-indigo-500"
        >
          <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
            <Plus className="h-6 w-6" />
          </motion.div>
        </motion.button>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-4 left-4 right-4 z-30 rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/40 backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-950/90 dark:shadow-none lg:hidden">
        <div className="flex items-center justify-around px-1.5 py-1.5">
          {mainNav.slice(0, 4).map((item) => (
            <BottomNavLink key={item.to} item={item} />
          ))}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <motion.div whileTap={{ scale: 0.9 }}>
              <Grid2X2 className="h-5 w-5" />
            </motion.div>
            <span>More</span>
          </button>
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
          'relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors duration-200',
          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="bottom-nav-pill"
              className="absolute inset-x-2 inset-y-0.5 -z-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <motion.div
            whileTap={{ scale: 0.9 }}
            animate={isActive ? { scale: 1.08, y: -1 } : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            <item.icon className="h-5 w-5" />
          </motion.div>
          <span>{item.label.split(' ')[0]}</span>
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
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100/80 px-5 py-5 dark:border-slate-800/50">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" className="h-9 w-9 rounded-xl object-cover shadow-md" alt="Zero Leak" />
          <div>
            <p className="font-display font-bold tracking-tight text-slate-900 dark:text-slate-100">Zero Leak</p>
            <p className="text-xs text-slate-400">Money, under control</p>
          </div>
        </div>
        <div className="hidden lg:block">
          <NotificationCenter />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3 no-scrollbar">
        <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Menu</p>
        {mainNav.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={onNavigate} />
        ))}
        <p className="px-3 py-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">More</p>
        {moreNav.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={onNavigate} />
        ))}
        {profile?.is_admin && (
          <>
            <p className="px-3 py-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Admin</p>
            <SidebarLink item={{ to: '/admin', label: 'Admin Panel', icon: Shield }} onClick={onNavigate} />
          </>
        )}
      </nav>

      <div className="space-y-2 border-t border-slate-100 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="h-9 w-9 rounded-full border border-slate-200/40 object-cover shadow-sm" alt="" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              {initials(profile?.full_name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{profile?.full_name || 'User'}</p>
            <p className="truncate text-xs text-slate-400">{profile?.email || ''}</p>
          </div>
          <button
            onClick={onSignOut}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-error-600 dark:hover:bg-slate-800"
            title="Sign out"
          >
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
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-300'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-y-1 left-0 w-1 rounded-full bg-indigo-500"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <item.icon className={cn('h-5 w-5 transition-transform duration-200 group-hover:scale-105', isActive && 'text-indigo-600 dark:text-indigo-400')} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}
