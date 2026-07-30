// Re-export shim. Filter prop/option types now live in shared; aliased to the old names.
export type {
  IPromotionListingFilterOptions as IAllPaFilterOptions,
  IPromotionListingFiltersProps as IAllPaFiltersProps,
} from '@/shared/components/PromotionListingFilters.types';
