export interface CalculateWithdrawalParams {
  currentInvestmentBalance: number;
  investedPrincipalToWithdraw: number;
  withdrawnAmount: number;
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
}

export function calculateWithdrawal({
  currentInvestmentBalance,
  investedPrincipalToWithdraw,
  withdrawnAmount,
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
    // Profit or break-even
    const transferAmount = Math.min(currentInvestmentBalance, investedPrincipalToWithdraw);
    const profitToAdd = Math.round((withdrawnAmount - transferAmount) * 100) / 100;
    const remainingBalance = Math.max(0, Math.round((currentInvestmentBalance - transferAmount) * 100) / 100);

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
    };
  } else {
    // Loss: withdrawnAmount < investedPrincipalToWithdraw
    const loss = Math.abs(diff);
    const transferAmount = Math.min(currentInvestmentBalance, withdrawnAmount);
    const remainingLossInInv = Math.min(currentInvestmentBalance - transferAmount, loss);
    const remainingBalance = Math.max(
      0,
      Math.round((currentInvestmentBalance - (transferAmount + remainingLossInInv)) * 100) / 100
    );
    const extraToDeposit = Math.round((withdrawnAmount - transferAmount) * 100) / 100;

    return {
      investedPrincipal: investedPrincipalToWithdraw,
      withdrawnAmount,
      profitLoss: diff,
      returnPercentage,
      remainingInvestmentBalance: remainingBalance,
      transferAmountFromInvestment: transferAmount,
      profitToCreditDestination: 0,
      lossToDeductFromInvestment: remainingLossInInv,
      extraToDepositDestination: extraToDeposit,
    };
  }
}
