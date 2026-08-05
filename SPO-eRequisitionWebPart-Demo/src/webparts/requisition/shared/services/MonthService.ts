// Promotion Month dropdown options, read live from the M_Month master list.
// Active rows only, ordered by NumberMonth (Jan..Dec) rather than alphabetically. The label
// must stay the plain calendar month name (e.g. "July") — FISCAL_MONTH_OPTIONS matching
// (shared/hooks/usePromotionListing.ts) and eRequisitionNumber.ts key off that exact string.

import { fetchMasterListOptions } from '@/shared/services/masterListOptions';
import { IOption } from '@/shared/types';

export const MONTH_MASTER_LIST_NAME = 'M_Month';

export function fetchMonthOptions(): Promise<IOption[]> {
  return fetchMasterListOptions({
    listName: MONTH_MASTER_LIST_NAME,
    valueField: 'Description',
    labelField: 'Description',
    odataFilter: 'Active eq 1',
    orderBy: 'NumberMonth asc',
  });
}
