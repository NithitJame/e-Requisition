// PA listing hook. The generic implementation lives in shared/hooks/usePromotionListing;
// this supplies the Promotion Activities Detail list-set and the /pa/request View route.

import { LIST_NAMES } from '@/features/pa/constants';
import { PAD_BASE_SELECT } from '@/shared/utils/promotionListingMapper';
import { IUsePromotionListing, usePromotionListing } from '@/shared/hooks/usePromotionListing';

export type IUseAllPaSearch = IUsePromotionListing;

export function useAllPaSearch(): IUsePromotionListing {
  return usePromotionListing({
    detailListName: LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL,
    baseSelect: PAD_BASE_SELECT,
    channelListName: LIST_NAMES.CUSTOMER_SUB_GROUP,
    categoryListName: LIST_NAMES.CATEGORY,
    viewRoutePrefix: '/pa/request',
    exportFileName: 'promotion-activities',
  });
}
