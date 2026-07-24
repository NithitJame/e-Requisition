// Pure helpers for TI/TD spending totals.

import { TITD_TYPE } from '@/features/pa/constants';
import { IExpenseRow, IRequisitionTransaction } from '@/features/pa/types';

export interface ISpendingTotals {
  totalSpendingTI: number;
  totalSpendingTD: number;
}

/** Sums committed expense values across all transactions, split by TI/TD type. */
export function calculateSpendingTotals(transactions: IRequisitionTransaction[]): ISpendingTotals {
  let totalSpendingTI = 0;
  let totalSpendingTD = 0;

  for (const transaction of transactions) {
    for (const expense of transaction.EstimatedPromotionExpense) {
      const committed = Number(expense.Committed) || 0;
      if (!expense.ExpenseType || committed <= 0) continue;
      if (expense.TITDType === TITD_TYPE.TD) totalSpendingTD += committed;
      else if (expense.TITDType === TITD_TYPE.TI) totalSpendingTI += committed;
    }
  }

  return { totalSpendingTI, totalSpendingTD };
}

/** Sums committed values for a single expense list filtered to one TI/TD type. */
export function sumCommittedByType(expenses: IExpenseRow[], type: string): number {
  return expenses
    .filter((expense) => expense.TITDType === type)
    .reduce((sum, expense) => sum + (Number(expense.Committed) || 0), 0);
}
