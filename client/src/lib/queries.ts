export const queryKeys = {
  profile: ['profile'],
  accounts: ['accounts'],
  account: (id: string) => ['accounts', id],
  categories: (type?: string) => ['categories', type].filter(Boolean),
  transactions: ['transactions'],
  transactionsFiltered: (filters: Record<string, unknown>) =>
    ['transactions', 'filtered', filters],
  transfers: ['transfers'],
  auditLogs: ['audit-logs'],
  dashboard: ['dashboard'],
  analytics: (range: string) => ['analytics', range],
  adminStats: ['admin', 'stats'],
  adminUsers: (search?: string) => ['admin', 'users', search].filter(Boolean),
};
