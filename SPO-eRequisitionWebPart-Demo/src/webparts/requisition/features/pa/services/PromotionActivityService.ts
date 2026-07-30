// PA-configured promotion-listing service. The generic implementation lives in
// shared/services/PromotionListingService; this subclass just supplies the
// "Promotion Activities Detail" list-set so existing AllPA/Approve callers are unchanged.

import { SPHttpClient } from '@microsoft/sp-http';

import { LIST_NAMES } from '@/features/pa/constants';
import { PAD_BASE_SELECT } from '@/shared/utils/promotionListingMapper';
import {
  IPromotionListingFilterOptions,
  PromotionListingService,
} from '@/shared/services/PromotionListingService';

/** @deprecated use IPromotionListingFilterOptions — kept for existing imports. */
export type IAllPaFilterSourceOptions = IPromotionListingFilterOptions;

export class PromotionActivityService extends PromotionListingService {
  public constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    super(spHttpClient, siteUrl, {
      detailListName: LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL,
      baseSelect: PAD_BASE_SELECT,
      channelListName: LIST_NAMES.CUSTOMER_SUB_GROUP,
      categoryListName: LIST_NAMES.CATEGORY,
    });
  }
}
