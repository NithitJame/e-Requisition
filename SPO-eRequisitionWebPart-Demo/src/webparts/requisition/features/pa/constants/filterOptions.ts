// Typed accessors for the static filter option data in shared/data/dataFilter.json.
// Form-specific option lists (channel/category/expense/promotion) live here; the listing
// option lists (month/status/eRequisitionNo) live in shared and are re-exported below.

import dataFilter from '@/shared/data/dataFilter.json';
import { IExpenseOption, IOption } from '@/features/pa/types';

export const channelOptions: IOption[] = dataFilter.Channel;
export const promotionOptions: IOption[] = dataFilter.promotionOptions;
export const categoryOptions: IOption[] = dataFilter.Category;
export const expenseOptions: IExpenseOption[] = dataFilter.ExpenseType;

// Listing filter options moved to shared; re-exported so existing pa imports keep working.
export {
  monthOptions,
  workflowStatusOptions,
  eRequisitionNoOptions,
} from '@/shared/constants/listingFilterOptions';
