export interface CalculateWithdrawalParams {
  currentInvestmentBalance: number;
  investedPrincipalToWithdraw: number;
  withdrawnAmount: number;
  isFullSettlement?: boolean;
}

export interface WithdrawalCalculationResult {
  investedPrincipal: number;
  withdrawnAmount: number;
  profitLoss: number;
  returnPercentage: number;
  remainingInvestmentBalance: number;
  transferAmountFromInvestment: number;
  profitToCreditDestination: number;
  lossToDeductFromInvestment: number;
  extraToDepositDestination: number;
  isFullSettlement: boolean;
}

export function calculateWithdrawal({
  currentInvestmentBalance,
  investedPrincipalToWithdraw,
  withdrawnAmount,
  isFullSettlement = false,
}: CalculateWithdrawalParams): WithdrawalCalculationResult {
  if (investedPrincipalToWithdraw <= 0) {
    throw new Error('Invested principal must be positive');
  }
  if (withdrawnAmount <= 0) {
    throw new Error('Withdrawn amount must be positive');
  }
  if (currentInvestmentBalance > 0 && investedPrincipalToWithdraw > currentInvestmentBalance) {
    throw new Error(
      `Withdrawal principal (₹${investedPrincipalToWithdraw}) cannot exceed investment account balance (₹${currentInvestmentBalance})`
    );
  }

  const diff = Math.round((withdrawnAmount - investedPrincipalToWithdraw) * 100) / 100;
  const returnPercentage =
    Math.round(((withdrawnAmount - investedPrincipalToWithdraw) / investedPrincipalToWithdraw) * 10000) / 100;

  if (diff >= 0) {
    // Profit or break-even (withdrawnAmount >= investedPrincipalToWithdraw)
    const transferAmount = Math.min(currentInvestmentBalance, investedPrincipalToWithdraw);
    const profitToAdd = Math.round((withdrawnAmount - transferAmount) * 100) / 100;
    const remainingBalance = isFullSettlement
      ? 0
      : Math.max(0, Math.round((currentInvestmentBalance - transferAmount) * 100) / 100);

    return {
      investedPrincipal: investedPrincipalToWithdraw,
      withdrawnAmount,
      profitLoss: diff,
      returnPercentage,
      remainingInvestmentBalance: remainingBalance,
      transferAmountFromInvestment: transferAmount,
      profitToCreditDestination: profitToAdd,
      lossToDeductFromInvestment: 0,
      extraToDepositDestination: 0,
      isFullSettlement,
    };
  } else {
    // Realized Loss (withdrawnAmount < investedPrincipalToWithdraw)
    const loss = Math.abs(diff);
    const transferAmount = Math.min(currentInvestmentBalance, withdrawnAmount);

    let lossToDeduct: number;
    let remainingBalance: number;

    if (isFullSettlement) {
      // 100% Full settlement: liquidate all remaining balance from investment account down to 0
      lossToDeduct = Math.max(0, Math.round((currentInvestmentBalance - transferAmount) * 100) / 100);
      remainingBalance = 0;
    } else {
      // Partial withdrawal at loss: only deduct the proportional loss on this slice
      lossToDeduct = Math.min(currentInvestmentBalance - transferAmount, loss);
      remainingBalance = Math.max(
        0,
        Math.round((currentInvestmentBalance - (transferAmount + lossToDeduct)) * 100) / 100
      );
    }

    const extraToDeposit = Math.round((withdrawnAmount - transferAmount) * 100) / 100;

    return {
      investedPrincipal: investedPrincipalToWithdraw,
      withdrawnAmount,
      profitLoss: diff,
      returnPercentage,
      remainingInvestmentBalance: remainingBalance,
      transferAmountFromInvestment: transferAmount,
      profitToCreditDestination: 0,
      lossToDeductFromInvestment: lossToDeduct,
      extraToDepositDestination: extraToDeposit,
      isFullSettlement,
    };
  }
}
