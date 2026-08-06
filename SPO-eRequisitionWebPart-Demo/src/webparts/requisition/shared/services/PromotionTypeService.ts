// Promotion Type dropdown options, read live from the M_PromotionType master list.

import { fetchMasterListOptions } from '@/shared/services/masterListOptions';
import { IOption } from '@/shared/types';

export const PROMOTION_TYPE_MASTER_LIST_NAME = 'M_PromotionType';

export function fetchPromotionTypeOptions(): Promise<IOption[]> {
  return fetchMasterListOptions({
    listName: PROMOTION_TYPE_MASTER_LIST_NAME,
    valueField: 'Description',
    labelField: 'Description',
    odataFilter: 'Active eq 1',
  });
}
