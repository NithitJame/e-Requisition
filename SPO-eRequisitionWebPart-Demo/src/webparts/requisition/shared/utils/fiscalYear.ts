import { FISCAL_MONTH_OPTIONS } from '@/shared/constants/promotionListing';
import { IOption, ISharePointItem } from '@/shared/types';

export function mapFiscalYearOptions(items: ISharePointItem[]): IOption[] {
  const years = new Set<string>();
  for (const item of items) {
    const year = String(item.Year ?? '').trim();
    if (year) years.add(year);
  }

  return Array.from(years)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((year) => ({ value: year, label: year }));
}

/** Zero-pads to 2 digits (avoids String.prototype.padStart — not in this project's lib target). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * The fiscal year label (e.g. "2526") covering `now`. The fiscal year runs September through
 * August, and its label is the last two digits of the start calendar year followed by the last
 * two digits of the end calendar year — e.g. September 2025 - August 2026 is "2526".
 */
export function getCurrentFiscalYearValue(now: Date = new Date()): string {
  const calendarYear = now.getFullYear();
  const startYear = now.getMonth() >= 8 ? calendarYear : calendarYear - 1; // month 8 = September
  const endYear = startYear + 1;
  return `${pad2(startYear % 100)}${pad2(endYear % 100)}`;
}

/**
 * The plain calendar year (e.g. "2025") for a fiscal-year + Promotion Month combination.
 * `fiscalYearValue` packs the last two digits of the start and end calendar year (see
 * getCurrentFiscalYearValue) — September-December fall in the start year, January-August in
 * the end year (see FISCAL_MONTH_OPTIONS). Assumes the 21st century (20xx), true for every
 * fiscal year this system has used so far. Returns undefined if either input is unresolvable.
 */
export function getCalendarYearForFiscalPeriod(
  fiscalYearValue: string | number | undefined,
  promotionMonthLabel: string | number | undefined,
): string | undefined {
  const fiscal = String(fiscalYearValue ?? '');
  if (fiscal.length !== 4) return undefined;
  const month = FISCAL_MONTH_OPTIONS.find((option) => option.label === promotionMonthLabel);
  if (!month) return undefined;

  const startYear = `20${fiscal.slice(0, 2)}`;
  const endYear = `20${fiscal.slice(2, 4)}`;
  // Fiscal months "01"-"04" = September-December (start year); "05"-"12" = January-August (end year).
  return Number(month.value) <= 4 ? startYear : endYear;
}
