import { useState, useMemo } from 'react';
import { 
  Users, Plus, Trash2, Check, X, Calendar, Search, CheckSquare,
  ChevronDown, ChevronUp, AlertCircle, Info, ArrowUpRight, ArrowDownLeft, CheckCircle2
} from 'lucide-react';
import { useDebts, useAddDebt, useUpdateDebtStatus, useDeleteDebt } from '@/hooks/useDebts';
import { formatCurrency, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonList, QueryError as ErrorBox } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

export function DebtsPage() {
  const { showToast } = useToast();
  const { data: debts, isLoading, isError } = useDebts();
  
  const addDebtMutation = useAddDebt();
  const updateDebtStatusMutation = useUpdateDebtStatus();
  const deleteDebtMutation = useDeleteDebt();

  // Navigation / Filter Tabs
  const [activeTab, setActiveTab] = useState<'active' | 'settled'>('active');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'lent' | 'borrowed'>('lent');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  // Accordion State for expanded friends
  const [expandedFriends, setExpandedFriends] = useState<Record<string, boolean>>({});
  // Expandable item state
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };


  // Form Submission
  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim() || !amount || Number(amount) <= 0) {
      showToast('Please fill in a valid name and positive amount', 'error');
      return;
    }

    try {
      await addDebtMutation.mutateAsync({
        friend_name: friendName.trim(),
        amount: Number(amount),
        type,
        date,
        description: description.trim() || null,
        status: 'pending'
      });
      showToast('Debt entry added successfully', 'success');
      // Reset form
      setFriendName('');
      setAmount('');
      setDescription('');
      setShowAddForm(false);
    } catch {
      showToast('Failed to add entry', 'error');
    }
  };

  // Toggle Status (Pending / Settled)
  const handleToggleStatus = async (id: string, currentStatus: 'pending' | 'settled') => {
    const nextStatus = currentStatus === 'pending' ? 'settled' : 'pending';
    try {
      await updateDebtStatusMutation.mutateAsync({ id, status: nextStatus });
      showToast(`Marked as ${nextStatus}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  // Settle All Pending Items for a Friend
  const handleSettleAllForFriend = async (friendName: string, items: typeof debts) => {
    if (!items) return;
    const pendingItems = items.filter(item => item.friend_name === friendName && item.status === 'pending');
    if (pendingItems.length === 0) return;

    if (!confirm(`Mark all ${pendingItems.length} pending items for ${friendName} as settled?`)) return;

    try {
      await Promise.all(
        pendingItems.map(item => updateDebtStatusMutation.mutateAsync({ id: item.id, status: 'settled' }))
      );
      showToast(`All items for ${friendName} settled!`, 'success');
    } catch {
      showToast('Failed to settle all items', 'error');
    }
  };

  // Delete Entry
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await deleteDebtMutation.mutateAsync(id);
      showToast('Entry deleted', 'success');
    } catch {
      showToast('Failed to delete entry', 'error');
    }
  };

  // Grouping and calculations logic
  const { groups, totalLent, totalBorrowed, netOutstanding } = useMemo(() => {
    let tLent = 0;
    let tBorrowed = 0;

    const list = debts ?? [];
    
    // Calculate global stats for pending items
    list.forEach(d => {
      if (d.status === 'pending') {
        if (d.type === 'lent') {
          tLent += Number(d.amount);
        } else {
          tBorrowed += Number(d.amount);
        }
      }
    });

    // Group by friend_name
    const friendGroups: Record<string, {
      friend_name: string;
      netBalance: number; // positive = friend owes you, negative = you owe friend
      pendingCount: number;
      totalCount: number;
      items: typeof list;
    }> = {};

    list.forEach(item => {
      const name = item.friend_name;
      if (!friendGroups[name]) {
        friendGroups[name] = {
          friend_name: name,
          netBalance: 0,
          pendingCount: 0,
          totalCount: 0,
          items: []
        };
      }

      friendGroups[name].items.push(item);
      friendGroups[name].totalCount += 1;

      // Add to person net balance if item is pending
      if (item.status === 'pending') {
        friendGroups[name].pendingCount += 1;
        if (item.type === 'lent') {
          friendGroups[name].netBalance += Number(item.amount);
        } else {
          friendGroups[name].netBalance -= Number(item.amount);
        }
      }
    });

    // Filter groups based on active tab and search query
    const filteredGroups = Object.values(friendGroups).filter(group => {
      // Apply search query filter
      if (searchQuery && !group.friend_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      if (activeTab === 'active') {
        return group.pendingCount > 0;
      } else {
        // Tab is settled: show groups with settled items
        return group.items.some(i => i.status === 'settled');
      }
    });

    return {
      groups: filteredGroups,
      totalLent: tLent,
      totalBorrowed: tBorrowed,
      netOutstanding: tLent - tBorrowed
    };
  }, [debts, activeTab, searchQuery]);

  const toggleAccordion = (name: string) => {
    setExpandedFriends(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  if (isLoading) return <SkeletonList count={4} />;
  if (isError) return <ErrorBox message="Could not load your debt ledger." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Debt Tracker" subtitle="Manage manual loans and helper ledger with friends" icon={Users} />

      {/* Global Net Balance Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-emerald-500/5 transition-transform group-hover:scale-110" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Owed to You (Lent)</p>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(totalLent)}
          </p>
        </div>
        <div className="card p-5 border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-rose-500/5 transition-transform group-hover:scale-110" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">You Owe Others (Borrowed)</p>
          <p className="mt-2 text-2xl font-black text-error-600 dark:text-error-400 tabular-nums">
            {formatCurrency(totalBorrowed)}
          </p>
        </div>
        <div className="card p-5 border border-indigo-100/50 dark:border-slate-800 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-slate-900 dark:to-slate-900/30 shadow-md relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-indigo-500/10 transition-transform group-hover:scale-110" />
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Net Outstanding Balance</p>
          <p className={`mt-2 text-2xl font-black tabular-nums ${
            netOutstanding >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-error-600 dark:text-error-400'
          }`}>
            {netOutstanding >= 0 ? '+' : ''}{formatCurrency(netOutstanding)}
          </p>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                activeTab === 'active' 
                  ? 'bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Active Debts
            </button>
            <button
              onClick={() => setActiveTab('settled')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                activeTab === 'settled' 
                  ? 'bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Settled History
            </button>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 active:scale-95 ${
              showAddForm
                ? 'bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/10'
            }`}
          >
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAddForm ? 'Close Form' : 'Add Debt / Loan'}
          </button>
        </div>

        {/* Search Input Filter */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10 text-xs py-2 bg-white dark:bg-slate-900 dark:border-slate-800"
            placeholder="Search by friend's name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Add New Debt Entry Form */}
      {showAddForm && (
        <form onSubmit={handleAddDebt} className="card p-6 border border-indigo-100/50 dark:border-slate-800/80 space-y-5 bg-gradient-to-b from-slate-50/50 to-slate-100/30 dark:from-slate-900/40 dark:to-slate-900/20">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-600" />
            Record a New Help/Loan Entry
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label text-slate-700 dark:text-slate-300">Friend's Name</label>
              <input 
                className="input mt-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-850" 
                value={friendName} 
                onChange={(e) => setFriendName(e.target.value)} 
                placeholder="e.g. John Doe" 
                required 
              />
            </div>
            <div>
              <label className="label text-slate-700 dark:text-slate-300">Amount</label>
              <input 
                type="number" 
                step="0.01" 
                className="input mt-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-850" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="0.00" 
                required 
              />
            </div>
            <div>
              <label className="label text-slate-700 dark:text-slate-300">Date</label>
              <input 
                type="date" 
                className="input mt-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-850" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="label text-slate-700 dark:text-slate-300">Type of Entry</label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setType('lent')}
                  className={`py-2 text-[11px] font-bold rounded-xl border-2 transition-all ${
                    type === 'lent'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  Lent (They owe me)
                </button>
                <button
                  type="button"
                  onClick={() => setType('borrowed')}
                  className={`py-2 text-[11px] font-bold rounded-xl border-2 transition-all ${
                    type === 'borrowed'
                      ? 'border-rose-500 bg-rose-50/50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  Borrowed (I owe them)
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="label text-slate-700 dark:text-slate-300">Description / Note</label>
            <input 
              className="input mt-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-850" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="e.g. Rent assistance, ticket booking, dinner share" 
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)} 
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary px-5 py-2 text-xs">
              Save Entry
            </button>
          </div>
        </form>
      )}

      {/* Grouped Accordion List */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="card p-10 text-center text-slate-550 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800">
            <Info className="mx-auto h-8 w-8 text-slate-400 mb-3" />
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">No {activeTab} records found</p>
            <p className="text-xs text-slate-450 mt-1">Use the "Add Debt / Loan" button above to add a manual entry.</p>
          </div>
        ) : (
          groups.map(group => {
            const isExpanded = !!expandedFriends[group.friend_name];
            
            // Items displayed in the active tab (pending) vs settled tab (settled)
            const filteredItems = group.items.filter(item => 
              activeTab === 'active' ? item.status === 'pending' : item.status === 'settled'
            );

            if (filteredItems.length === 0) return null;

            // Calculate progress: settled items out of total items for this person
            const settledCount = group.items.filter(item => item.status === 'settled').length;
            const totalCount = group.items.length;
            const progressPercent = totalCount > 0 ? (settledCount / totalCount) * 100 : 0;

            const pendingLentItems = group.items.filter(item => item.status === 'pending' && item.type === 'lent');
            const pendingBorrowedItems = group.items.filter(item => item.status === 'pending' && item.type === 'borrowed');

            return (
              <div 
                key={group.friend_name} 
                className="card overflow-hidden border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 shadow-sm transition hover:shadow-md duration-200"
              >
                {/* Accordion Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full p-5 gap-3.5 bg-white dark:bg-slate-900/60">
                  <button
                    onClick={() => toggleAccordion(group.friend_name)}
                    className="flex-1 flex items-center gap-3.5 text-left min-w-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-950/40 dark:to-indigo-950/20 text-indigo-650 dark:text-indigo-400 font-bold border border-indigo-100/30">
                      <span className="font-bold text-sm uppercase">{group.friend_name[0]}</span>
                    </div>
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{group.friend_name}</p>
                      
                      {/* Mini Progress bar indicator */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                          {settledCount}/{totalCount} Settled
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 pt-2.5 sm:pt-0 shrink-0">
                    {/* Net Balance calculations display */}
                    <div className="text-left sm:text-right">
                      <p className={`text-xs font-bold whitespace-nowrap ${
                        group.netBalance > 0 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : group.netBalance < 0 
                            ? 'text-rose-600 dark:text-rose-450' 
                            : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {group.netBalance > 0 
                          ? `Owes you ${formatCurrency(group.netBalance)}` 
                          : group.netBalance < 0 
                            ? `You owe ${formatCurrency(Math.abs(group.netBalance))}` 
                            : 'Settled'
                        }
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider mt-0.5">Net Owed</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Settle All action button */}
                      {activeTab === 'active' && group.pendingCount > 0 && (
                        <button
                          onClick={() => handleSettleAllForFriend(group.friend_name, group.items)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/30 rounded-lg transition"
                          title="Mark all items for this person as settled"
                        >
                          <CheckSquare className="h-3 w-3" />
                          Settle All
                        </button>
                      )}

                      {/* Accordion trigger arrow */}
                      <button 
                        onClick={() => toggleAccordion(group.friend_name)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/20 dark:bg-slate-900/20 px-5.5 py-4">
                    <div className="space-y-3">
                      {filteredItems.map(item => {
                        const isItemExpanded = !!expandedItems[item.id];
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => toggleItemExpansion(item.id)}
                            className={`px-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${
                              isItemExpanded ? 'py-4 space-y-3' : 'py-2.5'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`mt-0.5 p-1 rounded-lg shrink-0 ${
                                  item.type === 'lent' 
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/25 dark:text-emerald-400' 
                                    : 'bg-rose-50 text-rose-600 dark:bg-rose-950/25 dark:text-rose-455'
                                }`}>
                                  {item.type === 'lent' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-xs font-bold text-slate-850 dark:text-slate-150 ${
                                    isItemExpanded ? 'break-words' : 'truncate max-w-[150px] sm:max-w-[280px]'
                                  }`}>
                                    {item.description || (item.type === 'lent' ? 'Money lent' : 'Money borrowed')}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-450 mt-0.5">
                                    <Calendar className="h-2.5 w-2.5 shrink-0" />
                                    <span>{formatDate(item.date)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <div className="text-right">
                                  <p className={`font-bold tabular-nums text-xs ${
                                    item.type === 'lent' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-455'
                                  }`}>
                                    {item.type === 'lent' ? '+' : '-'}{formatCurrency(item.amount)}
                                  </p>
                                  <span className={`inline-block px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded ${
                                    item.status === 'pending' 
                                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30' 
                                      : 'bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-455'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3.5">
                                  <button
                                    onClick={() => handleToggleStatus(item.id, item.status)}
                                    className={`p-2 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                      item.status === 'pending'
                                        ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
                                        : 'text-slate-400 hover:text-slate-650 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                    title={item.status === 'pending' ? 'Mark as Settled' : 'Re-open Entry'}
                                  >
                                    <Check className="h-4.5 w-4.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-2 text-slate-400 hover:text-error-600 dark:hover:text-error-400 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                    title="Delete Entry"
                                  >
                                    <Trash2 className="h-4.5 w-4.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isItemExpanded && item.description && (
                              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-lg" onClick={(e) => e.stopPropagation()}>
                                <span className="font-semibold block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Full Note:</span>
                                {item.description}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
