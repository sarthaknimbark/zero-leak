import {
  mapInvestmentTransferToTransaction,
  sortTransactionsChronological,
} from '../routes/transactions.js';

describe('Transactions & Investment Transfers Mapping', () => {
  describe('mapInvestmentTransferToTransaction', () => {
    it('correctly maps an investment deposit transfer into an investment transaction', () => {
      const mockDepositTransfer = {
        id: 'tf-12345',
        user_id: 'usr-999',
        from_account_id: 'bank-acc-id',
        to_account_id: 'invest-acc-id',
        amount: 25000,
        date: '2026-11-20',
        time: '14:30:00',
        description: null,
        notes: 'Monthly mutual fund SIP',
        created_at: '2026-11-20T14:30:00.000Z',
        from_account: {
          id: 'bank-acc-id',
          name: 'HDFC Bank',
          type: 'bank',
          color: '#2563eb',
          icon: 'landmark',
        },
        to_account: {
          id: 'invest-acc-id',
          name: 'Nifty 50 Index Fund',
          type: 'investment',
          color: '#8b5cf6',
          icon: 'trending-up',
        },
      };

      const mapped = mapInvestmentTransferToTransaction(mockDepositTransfer);

      expect(mapped.id).toBe('transfer-tf-12345');
      expect(mapped.type).toBe('investment');
      expect(mapped.amount).toBe(25000);
      expect(mapped.date).toBe('2026-11-20');
      expect(mapped.time).toBe('14:30:00');
      expect(mapped.description).toBe('Investment Deposit: Nifty 50 Index Fund');
      expect(mapped.tags).toEqual(['investment', 'deposit']);
      expect(mapped.account_id).toBe('bank-acc-id');
      expect(mapped.account?.name).toBe('HDFC Bank');
      expect(mapped.category.name).toBe('Investments');
    });

    it('correctly maps a principal return withdrawal transfer into an investment transaction', () => {
      const mockWithdrawalTransfer = {
        id: 'tf-67890',
        user_id: 'usr-999',
        from_account_id: 'invest-acc-id',
        to_account_id: 'bank-acc-id',
        amount: 15000,
        date: '2026-11-21',
        time: '11:15:00',
        description: 'Partial Redemption TCS shares',
        notes: 'Returned to ICICI Bank',
        created_at: '2026-11-21T11:15:00.000Z',
        from_account: {
          id: 'invest-acc-id',
          name: 'Zerodha Stocks',
          type: 'investment',
          color: '#8b5cf6',
          icon: 'trending-up',
        },
        to_account: {
          id: 'bank-acc-id',
          name: 'ICICI Bank',
          type: 'bank',
          color: '#ea580c',
          icon: 'landmark',
        },
      };

      const mapped = mapInvestmentTransferToTransaction(mockWithdrawalTransfer);

      expect(mapped.id).toBe('transfer-tf-67890');
      expect(mapped.type).toBe('investment');
      expect(mapped.amount).toBe(15000);
      expect(mapped.date).toBe('2026-11-21');
      expect(mapped.time).toBe('11:15:00');
      // Kept custom description if provided
      expect(mapped.description).toBe('Partial Redemption TCS shares');
      expect(mapped.tags).toEqual(['investment', 'principal-return']);
      // Receiving account is ICICI Bank
      expect(mapped.account_id).toBe('bank-acc-id');
      expect(mapped.account?.name).toBe('ICICI Bank');
    });

    it('provides fallback description when description is null or empty', () => {
      const mockTransfer = {
        id: 'tf-fallback',
        user_id: 'usr-1',
        from_account_id: 'invest-1',
        to_account_id: 'bank-1',
        amount: 5000,
        date: '2026-11-21',
        time: null,
        description: '',
        from_account: { id: 'invest-1', name: 'Crypto Wallet', type: 'investment' },
        to_account: { id: 'bank-1', name: 'Cash', type: 'cash' },
      };

      const mapped = mapInvestmentTransferToTransaction(mockTransfer);
      expect(mapped.description).toBe('Principal Returned: Crypto Wallet');
      expect(mapped.time).toBe('00:00:00');
    });
  });

  describe('sortTransactionsChronological', () => {
    it('sorts transactions by date descending and time descending', () => {
      const items = [
        { id: '1', date: '2026-11-19', time: '10:00:00' },
        { id: '2', date: '2026-11-21', time: '09:00:00' },
        { id: '3', date: '2026-11-21', time: '15:30:00' },
        { id: '4', date: '2026-11-20', time: '12:00:00' },
      ];

      const sorted = sortTransactionsChronological(items);

      expect(sorted.map((i) => i.id)).toEqual(['3', '2', '4', '1']);
    });

    it('handles missing or empty time strings without failing', () => {
      const items = [
        { id: 'a', date: '2026-11-20', time: null },
        { id: 'b', date: '2026-11-20', time: '18:00:00' },
      ];

      const sorted = sortTransactionsChronological(items);
      expect(sorted[0].id).toBe('b');
      expect(sorted[1].id).toBe('a');
    });
  });
});
