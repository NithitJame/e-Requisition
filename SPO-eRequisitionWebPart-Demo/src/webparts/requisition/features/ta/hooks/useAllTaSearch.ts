// TA listing hook. Reuses the generic shared listing hook with the TA Detail list-set and
// the /ta/request View route. TA Detail has no `…Adjust` fields, so the base select omits them.

import { TA_LISTS } from '@/features/ta/constants';
import { TA_DETAIL_BASE_SELECT } from '@/shared/utils/promotionListingMapper';
import { IUsePromotionListing, usePromotionListing } from '@/shared/hooks/usePromotionListing';

export function useAllTaSearch(): IUsePromotionListing {
  return usePromotionListing({
    detailListName: TA_LISTS.DETAIL,
    baseSelect: TA_DETAIL_BASE_SELECT,
    channelListName: TA_LISTS.CHANNEL_MASTER,
    categoryListName: TA_LISTS.CATEGORY_MASTER,
    viewRoutePrefix: '/ta/request',
    exportFileName: 'trade-agreement',
  });
}
