// Pure mapping from raw SharePoint data to the RequestPA form model.
// Mirrors the original getData() transform, but free of fetching and side effects.

import {
  IOption,
  IRequisitionOptionSet,
  IRequisitionRawData,
  IRequisitionTransaction,
  ISharePointItem,
} from '@/features/pa/types';
import { channelCodeFromTPMNo, monthLabelFromTPMNo } from './eRequisitionNumber';
import { findOption, getLookupValue, toArray, toNumber } from '@/shared/utils/lookup';

export interface IMappedRequisition {
  transactions: IRequisitionTransaction[];
  channel: IOption | null;
  fiscalYear: IOption | null;
  promotionMonth: IOption | null;
  totalSpendingTI: number;
  totalSpendingTD: number;
}

/** Groups child rows by their `Title` foreign key (-> Promotion Activities Detail.Title). */
function bucketByTitle(rows: ISharePointItem[]): Record<string, ISharePointItem[]> {
  const buckets: Record<string, ISharePointItem[]> = {};
  for (const row of rows) {
    const title = String(row.Title);
    (buckets[title] = buckets[title] || []).push(row);
  }
  return buckets;
}

function mapExpenses(
  rows: ISharePointItem[],
  expenseOptions: IRequisitionOptionSet['expenseOptions'],
): IRequisitionTransaction['EstimatedPromotionExpense'] {
  return rows.map((expense) => ({
    // Expense Type comes from Account Name; the TI/TD type comes from ExpenseType.
    ExpenseType: findOption(expenseOptions, getLookupValue(expense.Account_x0020_Name)),
    TITDType: getLookupValue(expense.ExpenseType) as string | null,
    Committed: toNumber(expense.Committed),
    Adjust: toNumber(expense.Adjust),
    Closed: Boolean(expense.ClosedExpense),
  }));
}

function mapChargeToCBU(
  rows: ISharePointItem[],
  majorGroupOptions: IOption[],
  categoryMap: Record<string, string>,
): IRequisitionTransaction['ChargeToCBU'] {
  return rows.map((cbu) => {
    const majorGroupName = getLookupValue(cbu.MajorGroupName);
    return {
      MajorGroupName: findOption(majorGroupOptions, majorGroupName),
      Category: majorGroupName ? categoryMap[String(majorGroupName)] ?? '' : '',
      Allocation: toNumber(cbu.Allocation),
    };
  });
}

/** Transforms raw SharePoint data into the form's transactions and header values. */
export function mapRawDataToForm(
  tpmNo: string,
  raw: IRequisitionRawData,
  options: IRequisitionOptionSet,
): IMappedRequisition {
  const padRows = [...raw.padRows].sort(
    (a, b) => (Number(a.Transaction) || 0) - (Number(b.Transaction) || 0),
  );

  const expensesByTitle = bucketByTitle(raw.expenseRows);
  const cbuByTitle = bucketByTitle(raw.cbuRows);

  const transactions: IRequisitionTransaction[] = padRows.map((row) => {
    const title = String(row.Title);
    const categories = toArray(row.Category);
    const categoryValue = categories.length > 0 ? getLookupValue(categories[0]) : null;

    return {
      Title: title,
      tebles: [
        {
          Transaction: Number(row.Transaction) || '',
          PromotionType: findOption(options.promotionOptions, getLookupValue(row.PromotionType)),
          Category: findOption(options.categoryOptions, categoryValue),
          W12: Boolean(row.W1_x002d_2),
          W34: Boolean(row.W3_x002d_4),
          Attachment: null,
          Amount: toNumber(row.Amount),
          Status: (row.Status as string) ?? null,
          Closed: false,
        },
      ],
      MechanicsDetails: (row.MechanicsDetails as string) || '',
      EstimatedPromotionExpense: mapExpenses(expensesByTitle[title] || [], options.expenseOptions),
      ChargeToCBU: mapChargeToCBU(
        cbuByTitle[title] || [],
        options.majorGroupOptions,
        raw.majorGroupCategoryMap,
      ),
      Comment: (row.Comments as string) || '',
    };
  });

  // Header values come from the first row, falling back to parsing the TPM number.
  const first: ISharePointItem = padRows[0] || {};
  const channelDesc = getLookupValue(first.CustomerSubGroup) ?? channelCodeFromTPMNo(tpmNo);
  const monthDesc = getLookupValue(first.PromotionMonth) ?? monthLabelFromTPMNo(tpmNo);

  const totalSpendingTI = padRows.reduce((sum, row) => sum + toNumber(row.TotalSpendingTICommitted), 0);
  const totalSpendingTD = padRows.reduce((sum, row) => sum + toNumber(row.TotalSpendingTDCommitted), 0);

  return {
    transactions,
    channel: findOption(options.channelOptions, channelDesc),
    fiscalYear: findOption(options.fiscalYearOptions, first.Fiscal),
    promotionMonth: findOption(options.monthOptions, monthDesc),
    totalSpendingTI,
    totalSpendingTD,
  };
}
