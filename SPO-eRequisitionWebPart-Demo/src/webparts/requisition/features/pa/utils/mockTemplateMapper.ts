// Adapts the bundled mock template (mockData/mockTemplate.json) into the raw shape
// mapRawDataToForm consumes, so the Mock Data Seeder reuses the production mapper
// (Option A / 3b — TASK_mock_data_seeder.md). No POST, no SharePoint read.
//
// The Phase-1 bundle stores lookups as integer `<Name>Id` fields, but mapRawDataToForm
// reads expanded `<Name>/Description` lookup objects. This adapter rehydrates each lookup
// to its Description so the form's dropdowns show real values:
//   • Category            — from the bundle's CATEGORY_TEXT (== M_Category.Description).
//   • ExpenseType (TI/TD) — from ExpenseTypeId via EXPENSE_TYPE_DESCRIPTION_BY_ID (POSTed).
//   • PromotionType / Account Name / MajorGroupName — display-only dropdowns, resolved from
//     mockData/lookupDescriptions.json (id -> Description, fetched read-only at dev time via
//     SharePoint_Scripts/fetchLookupMaps.py). Unknown ids fall through to synthetic options.
//   • Charge-to-CBU Category — the read-only category beside each MajorGroupName, keyed by
//     the MajorGroupName Description (mirrors RequisitionService.loadMajorGroupCategoryMap).

import rawMockTemplate from '../data/mockTemplate.json';
import lookupDescriptions from '../data/lookupDescriptions.json';
import { EXPENSE_TYPE_DESCRIPTION_BY_ID } from '@/features/pa/constants';
import { transformReqNumbers } from './requisitionNumberUtils';
import { IRequisitionRawData, ISharePointItem } from '@/features/pa/types';

/** Shape of the bundled mockData/mockTemplate.json produced by Phase 1. */
interface IMockTemplate {
  transactions: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  allocations: Array<Record<string, unknown>>;
}

/** Raw mock data plus a representative TPM number for header (channel/month) parsing. */
export interface IMockRawData {
  tpmNo: string;
  rawData: IRequisitionRawData;
}

const template = rawMockTemplate as unknown as IMockTemplate;

const PROMOTION_TYPE_BY_ID = lookupDescriptions.PromotionType as Record<string, string>;
const ACCOUNT_NAME_BY_ID = lookupDescriptions.AccountName as Record<string, string>;
const MAJOR_GROUP_BY_ID = lookupDescriptions.MajorGroupName as Record<string, string>;
// MajorGroupName Description -> Category (for the CBU read-only Category cell).
const MAJOR_GROUP_CATEGORY = lookupDescriptions.MajorGroupCategory as Record<string, string>;

/** Wraps a resolved Description as an expanded lookup object, or undefined when unresolved. */
function expandLookup(
  descriptionById: Record<string, string>,
  id: unknown,
): { Description: string } | undefined {
  if (id === null || id === undefined) return undefined;
  const description = descriptionById[String(id)];
  return description ? { Description: description } : undefined;
}

/** Rewrites FY/Month in e-Req number fields and rehydrates the transaction's lookups. */
function adaptTransaction(raw: Record<string, unknown>, fy: string, month: string): ISharePointItem {
  const row = transformReqNumbers(raw, fy, month);
  const categoryText = row.CATEGORY_TEXT;
  return {
    ...row,
    // Override the migrated Fiscal so mapRawDataToForm resolves the chosen fiscal year.
    Fiscal: fy,
    // Expose Category as an expanded lookup so getLookupValue() reads its Description.
    Category: typeof categoryText === 'string' && categoryText ? [{ Description: categoryText }] : [],
    PromotionType: expandLookup(PROMOTION_TYPE_BY_ID, row.PromotionTypeId),
  };
}

/** Rewrites e-Req numbers and rehydrates the expense's lookups (TI/TD + Account Name). */
function adaptExpense(raw: Record<string, unknown>, fy: string, month: string): ISharePointItem {
  const row = transformReqNumbers(raw, fy, month);
  const titdType = EXPENSE_TYPE_DESCRIPTION_BY_ID[Number(row.ExpenseTypeId)];
  return {
    ...row,
    // mapRawDataToForm reads ExpenseType.Description -> TITDType; Submit re-derives the id.
    ExpenseType: titdType ? { Description: titdType } : null,
    // Account Name drives the (display-only) Expense Type dropdown.
    Account_x0020_Name: expandLookup(ACCOUNT_NAME_BY_ID, row.Account_x0020_NameId),
  };
}

/** Rewrites e-Req numbers and rehydrates the allocation's MajorGroupName lookup. */
function adaptAllocation(raw: Record<string, unknown>, fy: string, month: string): ISharePointItem {
  const row = transformReqNumbers(raw, fy, month);
  return {
    ...row,
    MajorGroupName: expandLookup(MAJOR_GROUP_BY_ID, row.MajorGroupNameId),
  };
}

/** Builds the raw mock data for the chosen fiscal period (no SharePoint access). */
export function buildMockRawData(fiscalYear: string, fiscalMonth: string): IMockRawData {
  const padRows = template.transactions.map((t) => adaptTransaction(t, fiscalYear, fiscalMonth));
  const expenseRows = template.expenses.map((e) => adaptExpense(e, fiscalYear, fiscalMonth));
  // Allocation is a plain number already (BR-03: each totals 100%); only its Title/TPMNo
  // are rewritten so the row buckets under the right parent, plus the MajorGroupName label.
  const cbuRows = template.allocations.map((a) => adaptAllocation(a, fiscalYear, fiscalMonth));
  const tpmNo = String(padRows.length > 0 ? padRows[0].TPMNo ?? '' : '');

  return {
    tpmNo,
    rawData: { padRows, expenseRows, cbuRows, majorGroupCategoryMap: MAJOR_GROUP_CATEGORY },
  };
}
