import { LIST_PAGE_SIZE } from '@/shared/constants/promotionListing';
import { IOption } from '@/shared/types';
import { fetchAllListItems } from '@/shared/utils/spItems';
import { mapFiscalYearOptions } from '@/shared/utils/fiscalYear';

export const FISCAL_YEAR_LIST_NAME = 'M_Fiscal_Year';

export async function fetchFiscalYearOptions(): Promise<IOption[]> {
  const items = await fetchAllListItems(
    FISCAL_YEAR_LIST_NAME,
    `$select=Year&$orderby=Year asc&$top=${LIST_PAGE_SIZE}`,
  );

  return mapFiscalYearOptions(items);
}
