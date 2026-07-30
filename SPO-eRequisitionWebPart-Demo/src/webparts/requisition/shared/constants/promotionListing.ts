// Shared constants for the promotion/trade-agreement listing screens (AllPA, AllTA, Approve).
// Domain-neutral enough to live in shared; feature constants re-export these for compatibility.

import { IOption } from '@/shared/types';

/** SharePoint list view threshold; pages are pulled in chunks of this size. */
export const LIST_PAGE_SIZE = 5000;

/**
 * Fiscal-month code -> calendar month label.
 * The fiscal year starts in September, so September = "01" (see docs/REQUIREMENTS.md §3).
 */
export const FISCAL_MONTH_OPTIONS: IOption[] = [
  { value: '05', label: 'January' },
  { value: '06', label: 'February' },
  { value: '07', label: 'March' },
  { value: '08', label: 'April' },
  { value: '09', label: 'May' },
  { value: '10', label: 'June' },
  { value: '11', label: 'July' },
  { value: '12', label: 'August' },
  { value: '01', label: 'September' },
  { value: '02', label: 'October' },
  { value: '03', label: 'November' },
  { value: '04', label: 'December' },
];
