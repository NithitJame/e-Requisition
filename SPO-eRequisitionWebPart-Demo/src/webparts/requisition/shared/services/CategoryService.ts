// Category dropdown options, read live from the M_Category master list.

import { fetchMasterListOptions } from '@/shared/services/masterListOptions';
import { IOption } from '@/shared/types';

export const CATEGORY_MASTER_LIST_NAME = 'M_Category';

export function fetchCategoryOptions(): Promise<IOption[]> {
  return fetchMasterListOptions({
    listName: CATEGORY_MASTER_LIST_NAME,
    valueField: 'Description',
    labelField: 'Description',
    odataFilter: 'Active eq 1',
  });
}
