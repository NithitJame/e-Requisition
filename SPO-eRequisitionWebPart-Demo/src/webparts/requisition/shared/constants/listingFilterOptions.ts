// Static filter-option lists shared by the promotion listing screens (AllPA, AllTA, Approve).
// Sourced from the bundled dataFilter.json. Channel/Category are loaded from SharePoint master
// lists at runtime, so they are not sourced here.

import dataFilter from '@/shared/data/dataFilter.json';
import { IOption } from '@/shared/types';

export const monthOptions: IOption[] = dataFilter.Month;
export const fiscalYearOptions: IOption[] = dataFilter.Year;
export const workflowStatusOptions: IOption[] = dataFilter.WorkFlowStatus;
export const eRequisitionNoOptions: IOption[] = dataFilter.eRequisitionNo;
