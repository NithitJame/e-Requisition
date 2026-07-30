// Re-export shim. The promotion-listing mapper now lives in shared/utils (shared by AllPA,
// AllTA, and the Approve inbox). Kept here so existing `@/features/pa/utils/...` imports work.
export {
  PAD_BASE_SELECT,
  TA_DETAIL_BASE_SELECT,
  PAD_LOOKUP_SELECT,
  PAD_EXPAND,
  mapRawPadToRow,
} from '@/shared/utils/promotionListingMapper';
export type { IRawLookup, IRawPadItem } from '@/shared/utils/promotionListingMapper';
