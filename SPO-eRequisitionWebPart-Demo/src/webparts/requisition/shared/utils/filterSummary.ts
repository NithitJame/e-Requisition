// Human-readable summaries of a filter selection, used for the "filters in effect" header
// block on Excel exports (AllPA / AllTA / Approve).

import { IOption } from '@/shared/types';

/** "All" when every loaded option is selected (or none), else the selected labels joined. */
export function multiSelectSummary(selected: IOption[] | null, allOptions: IOption[]): string {
  if (!selected || selected.length === 0) return 'All';
  if (allOptions.length > 0 && selected.length === allOptions.length) return 'All';
  return selected.map((option) => option.label).join(', ');
}

/** "All" when nothing is selected, else the selected option's label. */
export function singleSelectSummary(selected: IOption | null): string {
  return selected ? selected.label : 'All';
}
