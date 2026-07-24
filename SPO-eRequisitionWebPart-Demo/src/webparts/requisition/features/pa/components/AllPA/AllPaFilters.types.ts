// Props for the AllPaFilters presentational component.

import { IAllPaFilterState, IOption } from '@/features/pa/types';

/** Static + dynamically-loaded option lists the filter selectors render. */
export interface IAllPaFilterOptions {
  channelOptions: IOption[];
  categoryOptions: IOption[];
  monthOptions: IOption[];
  yearOptions: IOption[];
  workflowStatusOptions: IOption[];
  eRequisitionNoOptions: IOption[];
}

export interface IAllPaFiltersProps {
  filters: IAllPaFilterState;
  options: IAllPaFilterOptions;
  onChange: <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]) => void;
  onSearch: () => void;
  onRefresh: () => void;
  onClear: () => void;
  /** Optional "Export To Excel" handler. When omitted the button stays inert (AllPA today). */
  onExport?: () => void;
}
