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
