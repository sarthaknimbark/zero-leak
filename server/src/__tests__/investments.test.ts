import { calculateWithdrawal } from '../lib/investmentLogic.js';

describe('Investment Partial Withdrawal & Dynamic Balance Logic', () => {
  describe('Partial Withdrawal with Profit (Gain)', () => {
    it('correctly calculates dynamic remaining balance and profit for a partial withdrawal', () => {
      // Example: User has ₹50,000 invested.
      // Liquidates a partial slice of ₹10,000 of principal (20% of portfolio).
      // The partial investment realized ₹12,500 at market value (+₹2,500 profit, +25%).
      const result = calculateWithdrawal({
        currentInvestmentBalance: 50000,
        investedPrincipalToWithdraw: 10000,
        withdrawnAmount: 12500,
      });

      expect(result.investedPrincipal).toBe(10000);
      expect(result.withdrawnAmount).toBe(12500);
      expect(result.profitLoss).toBe(2500);
      expect(result.returnPercentage).toBe(25);

      // Dynamic remaining balance in the investment account
      expect(result.remainingInvestmentBalance).toBe(40000);

      // Financial movement breakdown
      // 1. ₹10,000 principal moved from investment to destination account
      expect(result.transferAmountFromInvestment).toBe(10000);
      // 2. ₹2,500 capital gain credited as investment return to destination account
      expect(result.profitToCreditDestination).toBe(2500);
      // Total received by destination: 10,000 + 2,500 = 12,500
      expect(result.transferAmountFromInvestment + result.profitToCreditDestination).toBe(12500);
    });

    it('handles 50% partial withdrawal with high ROI', () => {
      // User has ₹100,000 invested. Liquidates ₹50,000 (50%).
      // Liquidated for ₹75,000 (+₹25,000 profit, +50%).
      const result = calculateWithdrawal({
        currentInvestmentBalance: 100000,
        investedPrincipalToWithdraw: 50000,
        withdrawnAmount: 75000,
      });

      expect(result.remainingInvestmentBalance).toBe(50000);
      expect(result.profitLoss).toBe(25000);
      expect(result.returnPercentage).toBe(50);
      expect(result.transferAmountFromInvestment).toBe(50000);
      expect(result.profitToCreditDestination).toBe(25000);
    });
  });

  describe('Partial Withdrawal with Realized Loss', () => {
    it('correctly calculates dynamic remaining balance and liquidated loss', () => {
      // Example: User has ₹40,000 invested.
      // Partially withdraws ₹10,000 of principal, but market dropped and realized ₹8,000 (-₹2,000 loss, -20%).
      const result = calculateWithdrawal({
        currentInvestmentBalance: 40000,
        investedPrincipalToWithdraw: 10000,
        withdrawnAmount: 8000,
      });

      expect(result.investedPrincipal).toBe(10000);
      expect(result.withdrawnAmount).toBe(8000);
      expect(result.profitLoss).toBe(-2000);
      expect(result.returnPercentage).toBe(-20);

      // The investment account balance is reduced by the full ₹10,000 position:
      // ₹40,000 - ₹10,000 = ₹30,000 remaining
      expect(result.remainingInvestmentBalance).toBe(30000);

      // ₹8,000 transferred to destination account
      expect(result.transferAmountFromInvestment).toBe(8000);
      // ₹2,000 loss deducted from investment account
      expect(result.lossToDeductFromInvestment).toBe(2000);
      // Total reduction from investment account: 8,000 + 2,000 = 10,000
      expect(result.transferAmountFromInvestment + result.lossToDeductFromInvestment).toBe(10000);
    });
  });

  describe('100% Full Settlement with Realized Loss', () => {
    it('liquidates entire remaining balance down to 0 and recognizes remaining loss on 100% full settlement', () => {
      // User invested ₹50,000. Market crashed or liquidation value is ₹35,000 (-₹15,000 loss).
      // With 100% full settlement, entire ₹50,000 account balance should be zeroed out.
      const result = calculateWithdrawal({
        currentInvestmentBalance: 50000,
        investedPrincipalToWithdraw: 50000,
        withdrawnAmount: 35000,
        isFullSettlement: true,
      });

      expect(result.isFullSettlement).toBe(true);
      expect(result.investedPrincipal).toBe(50000);
      expect(result.withdrawnAmount).toBe(35000);
      expect(result.profitLoss).toBe(-15000);
      expect(result.returnPercentage).toBe(-30);

      // Entire investment account is liquidated down to ₹0.00
      expect(result.remainingInvestmentBalance).toBe(0);

      // ₹35,000 transferred to destination bank account
      expect(result.transferAmountFromInvestment).toBe(35000);
      // Remaining ₹15,000 deducted from investment account as realized loss
      expect(result.lossToDeductFromInvestment).toBe(15000);
      // Total reduction from investment account: 35,000 + 15,000 = 50,000
      expect(result.transferAmountFromInvestment + result.lossToDeductFromInvestment).toBe(50000);
    });

    it('handles partial withdrawal at loss when isFullSettlement is false vs true', () => {
      // Scenario: User has ₹100,000 total balance.
      // Sells a slice of ₹40,000 principal for ₹30,000 (-₹10,000 loss).
      // Case A: Partial withdrawal (isFullSettlement = false)
      const partialResult = calculateWithdrawal({
        currentInvestmentBalance: 100000,
        investedPrincipalToWithdraw: 40000,
        withdrawnAmount: 30000,
        isFullSettlement: false,
      });

      expect(partialResult.remainingInvestmentBalance).toBe(60000); // 100,000 - 40,000 = 60,000
      expect(partialResult.transferAmountFromInvestment).toBe(30000);
      expect(partialResult.lossToDeductFromInvestment).toBe(10000);

      // Case B: 100% full settlement (isFullSettlement = true)
      const fullResult = calculateWithdrawal({
        currentInvestmentBalance: 100000,
        investedPrincipalToWithdraw: 100000,
        withdrawnAmount: 70000,
        isFullSettlement: true,
      });

      expect(fullResult.remainingInvestmentBalance).toBe(0);
      expect(fullResult.transferAmountFromInvestment).toBe(70000);
      expect(fullResult.lossToDeductFromInvestment).toBe(30000);
    });
  });

  describe('Full 100% Liquidation', () => {
    it('reduces investment balance to 0 and credits full withdrawal to destination', () => {
      const result = calculateWithdrawal({
        currentInvestmentBalance: 25000,
        investedPrincipalToWithdraw: 25000,
        withdrawnAmount: 30000,
      });

      expect(result.remainingInvestmentBalance).toBe(0);
      expect(result.profitLoss).toBe(5000);
      expect(result.returnPercentage).toBe(20);
      expect(result.transferAmountFromInvestment).toBe(25000);
      expect(result.profitToCreditDestination).toBe(5000);
    });
  });

  describe('Break-even Withdrawal', () => {
    it('returns exact principal with 0% profit/loss', () => {
      const result = calculateWithdrawal({
        currentInvestmentBalance: 50000,
        investedPrincipalToWithdraw: 15000,
        withdrawnAmount: 15000,
      });

      expect(result.remainingInvestmentBalance).toBe(35000);
      expect(result.profitLoss).toBe(0);
      expect(result.returnPercentage).toBe(0);
      expect(result.transferAmountFromInvestment).toBe(15000);
      expect(result.profitToCreditDestination).toBe(0);
    });
  });

  describe('Validation & Over-withdrawal Guards', () => {
    it('throws an error if withdrawal principal exceeds available investment balance', () => {
      expect(() => {
        calculateWithdrawal({
          currentInvestmentBalance: 20000,
          investedPrincipalToWithdraw: 25000,
          withdrawnAmount: 30000,
        });
      }).toThrow('Withdrawal principal (₹25000) cannot exceed investment account balance (₹20000)');
    });

    it('throws an error for non-positive invested principal', () => {
      expect(() => {
        calculateWithdrawal({
          currentInvestmentBalance: 20000,
          investedPrincipalToWithdraw: 0,
          withdrawnAmount: 10000,
        });
      }).toThrow('Invested principal must be positive');
    });

    it('throws an error for non-positive withdrawn amount', () => {
      expect(() => {
        calculateWithdrawal({
          currentInvestmentBalance: 20000,
          investedPrincipalToWithdraw: 5000,
          withdrawnAmount: -100,
        });
      }).toThrow('Withdrawn amount must be positive');
    });
  });
});
