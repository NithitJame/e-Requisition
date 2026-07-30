// Re-export shim. The promotion-listing filter/sort now lives in shared/utils (shared by
// AllPA, AllTA, and the Approve inbox). Kept here so existing `@/features/pa/utils/...` work.
export {
  comparePromotionActivities,
  filterPromotionActivities,
} from '@/shared/utils/promotionListingFilter';
