// Re-export shim. The listing business columns now live in shared/components (shared by AllPA,
// AllTA, Approve). Kept here (as getAllPaColumns) so existing pa imports keep working.
export { getPromotionListingColumns as getAllPaColumns } from '@/shared/components/promotionListingColumns';
