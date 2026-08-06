// Typed accessor for the static ExpenseType option data in shared/data/dataFilter.json.
// Channel/Month/WorkflowStatus/Category/PromotionType are read live from SharePoint master
// lists instead (see shared/services/ChannelService.ts, MonthService.ts, WorkflowStatusService.ts,
// CategoryService.ts, PromotionTypeService.ts). ExpenseType stays static because its TI/TD
// grouping isn't a column on M_ExpenseType — see mockData.ts's EXPENSE_TYPE_DESCRIPTION_BY_ID
// for the same constraint on the id-keyed variant.
import dataFilter from '@/shared/data/dataFilter.json';
import { IExpenseOption } from '@/features/pa/types';

export const expenseOptions: IExpenseOption[] = dataFilter.ExpenseType;
