// Pure, client-side filtering + sorting for the promotion/trade-agreement listing screens.
// Shared by AllPA, AllTA, and the Approve inbox. Kept out of components/hooks so the matching
// rules can be unit-tested and read in isolation (see docs/CONVENTIONS.md §6).

import { FISCAL_MONTH_OPTIONS } from '@/shared/constants/promotionListing';
import { IAllPaFilterState, IOption, IPromotionActivityRow } from '@/shared/types';

const PROMOTION_WEEK = { W1_2: 'W1-2', W3_4: 'W3-4', ALL: 'All' } as const;

/**
 * Calendar month name -> fiscal ordinal (September = 1 ... August = 12). The "Promotion Month
 * From/To" range is evaluated in FISCAL order, consistent with the rest of the app.
 */
const FISCAL_ORDINAL_BY_MONTH: Record<string, number> = FISCAL_MONTH_OPTIONS.reduce(
  (acc, option) => {
    acc[option.label] = Number(option.value);
    return acc;
  },
  {} as Record<string, number>,
);

/**
 * Sort comparator for the listing: by E-Requisition No. (`TPMNo`) ascending, then by
 * Transaction number ascending.
 */
export function comparePromotionActivities(
  a: IPromotionActivityRow,
  b: IPromotionActivityRow,
): number {
  const byTpmNo = String(a.TPMNo ?? '').localeCompare(String(b.TPMNo ?? ''));
  if (byTpmNo !== 0) return byTpmNo;
  return (Number(a.Transaction) || 0) - (Number(b.Transaction) || 0);
}

/** True when any selected option matches `target` by either its value or its label. */
function matchesAny(selected: IOption[], target: string | undefined): boolean {
  if (!target) return false;
  return selected.some((option) => option.value === target || option.label === target);
}

/** True when the single selected option matches `target` by value or label. */
function matchesOne(selected: IOption, target: string | undefined): boolean {
  if (!target) return false;
  return selected.value === target || selected.label === target;
}

/** Fiscal ordinal for a selected month option (matched by label first, then value). */
function monthOrdinal(option: IOption | null): number | undefined {
  if (!option) return undefined;
  return FISCAL_ORDINAL_BY_MONTH[option.label] ?? FISCAL_ORDINAL_BY_MONTH[String(option.value)];
}

/**
 * Distinct, sorted E-Requisition No. (`TPMNo`) options derived from a set of rows — reflects
 * whatever is actually loaded from SharePoint right now, instead of a stale bundled list.
 */
export function buildERequisitionNoOptions(rows: IPromotionActivityRow[]): IOption[] {
  const values = new Set<string>();
  for (const row of rows) {
    if (row.TPMNo) values.add(row.TPMNo);
  }
  return Array.from(values)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((tpmNo) => ({ value: tpmNo, label: tpmNo }));
}

/** True when the row satisfies the selected Promotion Week radio. "All" applies no constraint. */
function matchesWeek(week: string, row: IPromotionActivityRow): boolean {
  if (week === PROMOTION_WEEK.W1_2) return row.W12;
  if (week === PROMOTION_WEEK.W3_4) return row.W34;
  return true;
}

/**
 * Filters the loaded rows by every active selection. An empty/absent selection means "no
 * constraint" for that field. Channel & Category are multi-select (match if ANY selected value
 * matches); the rest are single-select. Month From/To form an inclusive fiscal range.
 */
export function filterPromotionActivities(
  rows: IPromotionActivityRow[],
  filters: IAllPaFilterState,
): IPromotionActivityRow[] {
  const channel = filters.channel;
  const category = filters.category;
  const hasChannel = !!channel && channel.length > 0;
  const hasCategory = !!category && category.length > 0;
  const monthFrom = monthOrdinal(filters.monthFrom);
  const monthTo = monthOrdinal(filters.monthTo);
  const hasMonthRange = monthFrom !== undefined || monthTo !== undefined;

  return rows.filter((row) => {
    if (hasChannel && !matchesAny(channel, row.CustomerSubGroup?.LookupValue)) return false;
    if (hasCategory && !row.Category.some((c) => matchesAny(category, c.LookupValue))) return false;
    if (filters.fiscalYear && !matchesOne(filters.fiscalYear, row.Fiscal)) return false;
    if (
      filters.workflowStatus &&
      !matchesOne(filters.workflowStatus, row.WorkflowStatus?.LookupValue)
    ) {
      return false;
    }
    if (filters.eRequisitionNo && !matchesOne(filters.eRequisitionNo, row.TPMNo)) return false;
    if (filters.expectedToClose && !matchesOne(filters.expectedToClose, row.ExpectedToClose)) return false;

    if (hasMonthRange) {
      const ordinal = FISCAL_ORDINAL_BY_MONTH[row.PromotionMonth?.LookupValue ?? ''];
      if (ordinal === undefined) return false;
      if (monthFrom !== undefined && ordinal < monthFrom) return false;
      if (monthTo !== undefined && ordinal > monthTo) return false;
    }

    if (filters.promotionWeek && !matchesWeek(filters.promotionWeek, row)) return false;

    return true;
  });
}
