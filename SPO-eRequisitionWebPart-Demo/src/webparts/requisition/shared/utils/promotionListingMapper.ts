// Shared shaping of raw Detail REST items (Promotion Activities Detail / TA Detail) into the
// normalised IPromotionActivityRow used by the listing screens. Both lists share this shape;
// TA Detail lacks the `…Adjust` fields, so callers pass a select list without them.

import { IPromotionActivityRow } from '@/shared/types';

// Plain fields + the display field of each lookup. NOTE: utilized totals are stored under
// the `_x0020_`-encoded internal names. Adjust fields exist on PAD only (omit for TA Detail).
export const PAD_BASE_SELECT: string[] = [
  'Id',
  'TPMNo',
  'Transaction',
  'Fiscal',
  'MechanicsDetails',
  'ExpectedToClose',
  'Delay',
  'TotalSpendingTICommitted',
  'TotalSpendingTDCommitted',
  'TotalSpendingTIAdjust',
  'TotalSpendingTDAdjust',
  'Total_x0020_Spending_x0020_TI',
  'Total_x0020_Spending_x0020_TD',
  'W1_x002d_2',
  'W3_x002d_4',
];

/** Same as PAD_BASE_SELECT without the `…Adjust` fields (TA Detail has no such columns). */
export const TA_DETAIL_BASE_SELECT: string[] = PAD_BASE_SELECT.filter(
  (field) => field !== 'TotalSpendingTIAdjust' && field !== 'TotalSpendingTDAdjust',
);

export const PAD_LOOKUP_SELECT: string[] = [
  'CustomerSubGroup/Description',
  'Category/Description',
  'PromotionType/Description',
  'PromotionMonth/Description',
  'WorkflowStatus/Title',
];

export const PAD_EXPAND = 'CustomerSubGroup,Category,PromotionType,PromotionMonth,WorkflowStatus';

/** A SharePoint lookup, expanded to its display field, as returned by the REST API. */
export interface IRawLookup {
  Description?: string;
}

/** The raw Detail item shape (only the fields we select/expand). */
export interface IRawPadItem {
  Id: number;
  TPMNo: string;
  Transaction: number | string;
  Fiscal: string;
  MechanicsDetails: string;
  ExpectedToClose: string;
  Delay: string;
  PromotionWeek?: string;
  TotalSpendingTICommitted?: number;
  TotalSpendingTDCommitted?: number;
  TotalSpendingTIAdjust?: number;
  TotalSpendingTDAdjust?: number;
  Total_x0020_Spending_x0020_TI?: number;
  Total_x0020_Spending_x0020_TD?: number;
  W1_x002d_2?: boolean;
  W3_x002d_4?: boolean;
  CustomerSubGroup?: IRawLookup;
  Category?: IRawLookup[] | { results?: IRawLookup[] };
  PromotionType?: IRawLookup;
  PromotionMonth?: IRawLookup;
  WorkflowStatus?: { Title?: string };
  // Present when a caller also selects these (e.g. the Approve inbox).
  Title?: string;
  PendingUserId?: number;
}

function toLookupValue(raw: IRawLookup | undefined): { LookupValue: string } | undefined {
  return raw && raw.Description !== undefined ? { LookupValue: raw.Description } : undefined;
}

function toArray<T>(value: T[] | { results?: T[] } | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.results)) return value.results;
  return [];
}

/** Normalises one raw Detail item into the listing row shape. */
export function mapRawPadToRow(item: IRawPadItem): IPromotionActivityRow {
  return {
    Id: item.Id,
    TPMNo: item.TPMNo,
    Transaction: item.Transaction,
    Fiscal: item.Fiscal,
    MechanicsDetails: item.MechanicsDetails,
    ExpectedToClose: item.ExpectedToClose,
    Delay: item.Delay,
    PromotionWeek: item.PromotionWeek,
    TotalSpendingTICommitted: item.TotalSpendingTICommitted,
    TotalSpendingTDCommitted: item.TotalSpendingTDCommitted,
    TotalSpendingTIAdjust: item.TotalSpendingTIAdjust,
    TotalSpendingTDAdjust: item.TotalSpendingTDAdjust,
    TotalSpendingTI: item.Total_x0020_Spending_x0020_TI,
    TotalSpendingTD: item.Total_x0020_Spending_x0020_TD,
    W12: item.W1_x002d_2 === true,
    W34: item.W3_x002d_4 === true,
    CustomerSubGroup: toLookupValue(item.CustomerSubGroup) ?? null,
    PromotionType: toLookupValue(item.PromotionType) ?? null,
    PromotionMonth: toLookupValue(item.PromotionMonth) ?? null,
    WorkflowStatus:
      item.WorkflowStatus && item.WorkflowStatus.Title !== undefined
        ? { LookupValue: item.WorkflowStatus.Title }
        : null,
    Category: toArray<IRawLookup>(item.Category).map((c) => ({ LookupValue: c.Description ?? '' })),
  };
}
