// Typed accessors for the static filter option data in components/dataFilter.json.
// Centralises the option lists so components/columns import from one typed source.

import dataFilter from '../data/dataFilter.json';
import { IExpenseOption, IOption } from '@/features/pa/types';

export const channelOptions: IOption[] = dataFilter.Channel;
export const fiscalYearOptions: IOption[] = dataFilter.Year;
export const monthOptions: IOption[] = dataFilter.Month;
export const promotionOptions: IOption[] = dataFilter.promotionOptions;
export const categoryOptions: IOption[] = dataFilter.Category;
export const expenseOptions: IExpenseOption[] = dataFilter.ExpenseType;

// Static filter options for the AllPA search screen (Channel/Category there are loaded
// from SharePoint master lists at runtime, so they are not sourced from here).
export const workflowStatusOptions: IOption[] = dataFilter.WorkFlowStatus;
export const eRequisitionNoOptions: IOption[] = dataFilter.eRequisitionNo;
