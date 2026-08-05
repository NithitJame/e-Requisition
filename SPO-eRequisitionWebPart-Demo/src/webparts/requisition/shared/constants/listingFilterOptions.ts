// Static filter-option lists shared by the promotion listing screens (AllPA, AllTA, Approve).
// Sourced from the bundled dataFilter.json. Channel/Category/Month/WorkflowStatus are all
// loaded from SharePoint master lists at runtime (see shared/services/), so they are not
// sourced here.

import dataFilter from '@/shared/data/dataFilter.json';
import { IOption } from '@/shared/types';

export const eRequisitionNoOptions: IOption[] = dataFilter.eRequisitionNo;
