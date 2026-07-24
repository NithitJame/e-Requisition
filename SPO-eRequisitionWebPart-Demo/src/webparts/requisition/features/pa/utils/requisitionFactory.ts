// Factory helpers that build empty form rows/transactions with consistent defaults.

import {
  IChargeToCBURow,
  IExpenseRow,
  IRequisitionTransaction,
  ITransactionRow,
} from '@/features/pa/types';

export function createEmptyTransactionRow(transactionNo: number): ITransactionRow {
  return {
    Transaction: transactionNo,
    PromotionType: null,
    Category: null,
    W12: false,
    W34: false,
    Attachment: null,
    Amount: 0,
    Status: null,
    Closed: false,
  };
}

export function createEmptyExpenseRow(): IExpenseRow {
  return { ExpenseType: null, TITDType: null, Committed: 0, Adjust: 0, Closed: false };
}

export function createEmptyChargeToCBURow(): IChargeToCBURow {
  return { MajorGroupName: null, Category: '', Allocation: 0 };
}

/** Builds a blank transaction block (one summary row, one expense, one CBU line). */
export function createEmptyTransaction(transactionNo: number): IRequisitionTransaction {
  return {
    tebles: [createEmptyTransactionRow(transactionNo)],
    MechanicsDetails: '',
    EstimatedPromotionExpense: [createEmptyExpenseRow()],
    ChargeToCBU: [createEmptyChargeToCBURow()],
    Comment: '',
  };
}
