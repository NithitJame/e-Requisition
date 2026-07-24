// Pure, client-side filtering for the AllPA listing. Kept out of the component/hook so the
// matching rules can be unit-tested and read in isolation (see docs/CONVENTIONS.md §6).

import { FISCAL_MONTH_OPTIONS } from '@/features/pa/constants';
import { IAllPaFilterState, IOption, IPromotionActivityRow } from '@/features/pa/types';

const PROMOTION_WEEK = { W1_2: 'W1-2', W3_4: 'W3-4', ALL: 'All' } as const;

/**
 * Calendar month name -> fiscal ordinal (September = 1 ... August = 12). The "Promotion Month
 * From/To" range is evaluated in FISCAL order, consistent with the rest of the app (the
 * e-Requisition number's month segment is fiscal; see docs/REQUIREMENTS.md §3). This only
 * matters for ranges that cross the calendar-year boundary (e.g. November -> February).
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
 * Transaction number ascending. `TPMNo` segments are zero-padded, so a plain string compare
 * orders them correctly; Transaction is compared numerically.
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

/** True when the row satisfies the selected Promotion Week radio. */
function matchesWeek(week: string, row: IPromotionActivityRow): boolean {
  if (week === PROMOTION_WEEK.W1_2) return row.W12;
  if (week === PROMOTION_WEEK.W3_4) return row.W34;
  if (week === PROMOTION_WEEK.ALL) return row.W12 && row.W34; // covers the whole month
  return true;
}

/**
 * Filters the loaded Promotion Activities by every active selection. An empty/absent selection
 * means "no constraint" for that field. Channel & Category are multi-select (match if ANY
 * selected value matches); the rest are single-select. Month From/To form an inclusive fiscal
 * range; the same month may be set in both to match a single month.
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
    // 1. Channel -> CustomerSubGroup (PAD stores the sub-group Description, e.g. "WATSON").
    if (hasChannel && !matchesAny(channel, row.CustomerSubGroup?.LookupValue)) return false;

    // 2. Category -> multi-value lookup; pass if ANY row category matches ANY selected one.
    if (hasCategory && !row.Category.some((c) => matchesAny(category, c.LookupValue))) return false;

    // 3. Fiscal Year -> plain text Fiscal column (e.g. "2526").
    if (filters.fiscalYear && !matchesOne(filters.fiscalYear, row.Fiscal)) return false;

    // 4. Status -> WorkflowStatus lookup (its Title, e.g. "Approved").
    if (filters.workflowStatus && !matchesOne(filters.workflowStatus, row.WorkflowStatus?.LookupValue)) {
      return false;
    }

    // 5. E-Requisition No. -> the TPMNo prefix (e.g. "7EPA1819-01").
    if (filters.eRequisitionNo && !matchesOne(filters.eRequisitionNo, row.TPMNo)) return false;

    // 6. Expected to Close -> calendar-month text (e.g. "December").
    if (filters.expectedToClose && !matchesOne(filters.expectedToClose, row.ExpectedToClose)) return false;

    // 7. Promotion Month From/To -> inclusive range in fiscal order.
    if (hasMonthRange) {
      const ordinal = FISCAL_ORDINAL_BY_MONTH[row.PromotionMonth?.LookupValue ?? ''];
      if (ordinal === undefined) return false;
      if (monthFrom !== undefined && ordinal < monthFrom) return false;
      if (monthTo !== undefined && ordinal > monthTo) return false;
    }

    // 8. Promotion Week -> W1-2 / W3-4 booleans.
    if (filters.promotionWeek && !matchesWeek(filters.promotionWeek, row)) return false;

    return true;
  });
}
