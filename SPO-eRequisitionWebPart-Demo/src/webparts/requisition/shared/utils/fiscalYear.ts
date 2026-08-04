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
