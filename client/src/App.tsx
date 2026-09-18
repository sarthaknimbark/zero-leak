import { ThemeProvider } from '@/context/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { QueryProvider } from '@/context/QueryContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AuthPage } from '@/pages/AuthPage';
import { PageSpinner } from '@/components/ui/Skeleton';
import { PinLock } from '@/components/security/PinLock';
import { DashboardPage } from '@/pages/DashboardPage';

const AccountsPage = lazy(() => import('@/pages/AccountsPage').then((m) => ({ default: m.AccountsPage })));
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
const TransfersPage = lazy(() => import('@/pages/TransfersPage').then((m) => ({ default: m.TransfersPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const SearchPage = lazy(() => import('@/pages/SearchPage').then((m) => ({ default: m.SearchPage })));
const ExportPage = lazy(() => import('@/pages/ExportPage').then((m) => ({ default: m.ExportPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const BillsPage = lazy(() => import('@/pages/BillsPage').then((m) => ({ default: m.BillsPage })));
const SavingsPage = lazy(() => import('@/pages/SavingsPage').then((m) => ({ default: m.SavingsPage })));
const LeaksPage = lazy(() => import('@/pages/LeaksPage').then((m) => ({ default: m.LeaksPage })));
const DebtsPage = lazy(() => import('@/pages/DebtsPage').then((m) => ({ default: m.DebtsPage })));

function AppRoutes() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell-bg flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10 animate-pulse rounded-xl shadow-glow" />
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<Suspense fallback={<PageSpinner />}><AccountsPage /></Suspense>} />
        <Route path="transactions" element={<Suspense fallback={<PageSpinner />}><TransactionsPage /></Suspense>} />
        <Route path="transfers" element={<Suspense fallback={<PageSpinner />}><TransfersPage /></Suspense>} />
        <Route path="analytics" element={<Suspense fallback={<PageSpinner />}><AnalyticsPage /></Suspense>} />
        <Route path="categories" element={<Suspense fallback={<PageSpinner />}><CategoriesPage /></Suspense>} />
        <Route path="search" element={<Suspense fallback={<PageSpinner />}><SearchPage /></Suspense>} />
        <Route path="export" element={<Suspense fallback={<PageSpinner />}><ExportPage /></Suspense>} />
        <Route path="profile" element={<Suspense fallback={<PageSpinner />}><ProfilePage /></Suspense>} />
        <Route path="debts" element={<Suspense fallback={<PageSpinner />}><DebtsPage /></Suspense>} />
        <Route path="bills" element={<Suspense fallback={<PageSpinner />}><BillsPage /></Suspense>} />
        <Route path="savings" element={<Suspense fallback={<PageSpinner />}><SavingsPage /></Suspense>} />
        <Route path="leaks" element={<Suspense fallback={<PageSpinner />}><LeaksPage /></Suspense>} />
        {profile?.is_admin && <Route path="admin" element={<Suspense fallback={<PageSpinner />}><AdminPage /></Suspense>} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}


export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <QueryProvider>
            <ToastProvider>
              <BrowserRouter>
                <PinLock>
                  <AppRoutes />
                </PinLock>
              </BrowserRouter>
            </ToastProvider>
          </QueryProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
