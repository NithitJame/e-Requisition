// Channel dropdown options, read live from the M_CustomerSubGroup master list (Nickname ->
// Description), matching PromotionListingService's existing listing-filter behaviour.

import { fetchMasterListOptions } from '@/shared/services/masterListOptions';
import { IOption } from '@/shared/types';

export const CHANNEL_MASTER_LIST_NAME = 'M_CustomerSubGroup';

export function fetchChannelOptions(): Promise<IOption[]> {
  return fetchMasterListOptions({
    listName: CHANNEL_MASTER_LIST_NAME,
    valueField: 'Nickname',
    labelField: 'Description',
  });
}
