// Props for the shared promotion/trade-agreement listing filter form.

import type { ReactNode } from 'react';
import { IAllPaFilterState, IOption } from '@/shared/types';

/** Static + dynamically-loaded option lists the filter selectors render. */
export interface IPromotionListingFilterOptions {
  channelOptions: IOption[];
  categoryOptions: IOption[];
  monthOptions: IOption[];
  yearOptions: IOption[];
  workflowStatusOptions: IOption[];
  eRequisitionNoOptions: IOption[];
}

export interface IPromotionListingFiltersProps {
  filters: IAllPaFilterState;
  options: IPromotionListingFilterOptions;
  onChange: <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]) => void;
  /** Also pulls fresh data before filtering — there is no separate Refresh button. */
  onSearch: () => void;
  onClear: () => void;
  /** Optional "Export To Excel" handler. When omitted the button stays inert. */
  onExport?: () => void;
  /** Optional extra action rendered right after "Export To Excel" (e.g. Approve's Confirm button). */
  extraAction?: ReactNode;
  /** Shows the small inline "Clear" button next to the Channel label. Defaults to true. */
  showChannelClear?: boolean;
  /** Shows the Category filter. Defaults to true (AllTA hides it per its SRS filter list). */
  showCategory?: boolean;
}
