// Pure validation for the RequestPA form (no side effects, no API calls).
//
// Both Save Draft and Submit enforce every required (*) field and the Charge-to-CBU 100%
// allocation rule (docs/REQUIREMENTS.md BR-03). Returns the first error message, or null
// when the form is valid to save.

import { IOption, IRequisitionTransaction } from '@/features/pa/types';

export interface IRequisitionValidationInput {
  eRequisitionNo: string;
  channel: IOption | null;
  fiscalYear: IOption | null;
  promotionMonth: IOption | null;
  transactions: IRequisitionTransaction[];
}

const ALLOCATION_TOTAL = 100;
const ALLOCATION_EPSILON = 0.01;

/** Returns the first validation error, or null when the form is valid to save. */
export function validateRequisition(input: IRequisitionValidationInput): string | null {
  const { eRequisitionNo, channel, fiscalYear, promotionMonth, transactions } = input;

  if (!eRequisitionNo) return 'กรุณาสร้าง eRequisition No ก่อน';
  if (!promotionMonth) return 'กรุณาสร้าง Promotion Month ก่อน';
  if (!channel) return 'กรุณาสร้าง Channel ก่อน';
  if (!fiscalYear) return 'กรุณาสร้าง Fiscal Year ก่อน';
  if (transactions.length === 0) return 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการ';

  for (let index = 0; index < transactions.length; index++) {
    const error = validateTransaction(transactions[index], index + 1);
    if (error) return error;
  }

  return null;
}

/** Validates one transaction's required (*) fields and its allocation total. */
function validateTransaction(transaction: IRequisitionTransaction, position: number): string | null {
  const summary = transaction.tebles[0];
  if (!summary || !summary.PromotionType) return `กรุณาเลือก Promotion Type (รายการที่ ${position})`;
  if (!summary.Category) return `กรุณาเลือก Category (รายการที่ ${position})`;
  if (!transaction.MechanicsDetails || !transaction.MechanicsDetails.trim()) {
    return `กรุณาระบุ Mechanics Details (รายการที่ ${position})`;
  }

  const expenseError = validateExpenses(transaction, position);
  if (expenseError) return expenseError;

  return validateAllocations(transaction, position);
}

/** Every expense row requires an Expense Type and a positive Committed value. */
function validateExpenses(transaction: IRequisitionTransaction, position: number): string | null {
  const expenses = transaction.EstimatedPromotionExpense;
  if (expenses.length === 0) return `กรุณาเพิ่ม Expense อย่างน้อย 1 รายการ (รายการที่ ${position})`;

  for (const expense of expenses) {
    if (!expense.ExpenseType) return `กรุณาเลือก Expense Type ให้ครบ (รายการที่ ${position})`;
    if (!(Number(expense.Committed) > 0)) return `กรุณาระบุ Committed ให้ครบ (รายการที่ ${position})`;
  }

  return null;
}

/** Every CBU row requires a MajorGroup Name; allocations must total 100% (BR-03). */
function validateAllocations(transaction: IRequisitionTransaction, position: number): string | null {
  const allocations = transaction.ChargeToCBU;
  if (allocations.length === 0) return `กรุณาเพิ่ม Charge to CBU อย่างน้อย 1 รายการ (รายการที่ ${position})`;

  for (const cbu of allocations) {
    if (!cbu.MajorGroupName) return `กรุณาเลือก MajorGroup Name ให้ครบ (รายการที่ ${position})`;
  }

  const total = allocations.reduce((sum, cbu) => sum + (Number(cbu.Allocation) || 0), 0);
  if (Math.abs(total - ALLOCATION_TOTAL) > ALLOCATION_EPSILON) {
    return `ผลรวม Allocation (รายการที่ ${position}) ต้องเท่ากับ 100 (ปัจจุบัน ${total})`;
  }

  return null;
}
