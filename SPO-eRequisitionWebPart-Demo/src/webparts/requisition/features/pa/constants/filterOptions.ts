// Typed accessors for the static filter option data in shared/data/dataFilter.json.
// Channel/Month/WorkflowStatus are no longer here — they're read live from SharePoint master
// lists (see shared/services/ChannelService.ts, MonthService.ts, WorkflowStatusService.ts).

import dataFilter from '@/shared/data/dataFilter.json';
import { IExpenseOption, IOption } from '@/features/pa/types';

export const promotionOptions: IOption[] = dataFilter.promotionOptions;
export const categoryOptions: IOption[] = dataFilter.Category;
export const expenseOptions: IExpenseOption[] = dataFilter.ExpenseType;

// Listing filter options moved to shared; re-exported so existing pa imports keep working.
export { eRequisitionNoOptions } from '@/shared/constants/listingFilterOptions';
