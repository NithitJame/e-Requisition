// Generic reader for SharePoint "M_*" master lists that back a dropdown's options.
// Extracted from PromotionListingService so every master-list-backed dropdown (Channel,
// Category, Month, WorkflowStatus, ...) shares one query/dedupe/sort implementation.

import { LIST_PAGE_SIZE } from '@/shared/constants/promotionListing';
import { IOption } from '@/shared/types';
import { fetchAllListItems } from '@/shared/utils/spItems';

export interface IMasterListOptionsQuery {
  listName: string;
  valueField: string;
  labelField: string;
  odataFilter?: string;
  /** e.g. "NumberMonth asc". When set, the list's own item order is kept (no alphabetical re-sort). */
  orderBy?: string;
}

/** Maps a master list to de-duplicated `IOption`s, sorted by label unless `orderBy` is given. */
export async function fetchMasterListOptions(query: IMasterListOptionsQuery): Promise<IOption[]> {
  const { listName, valueField, labelField, odataFilter, orderBy } = query;
  const fields = Array.from(new Set([valueField, labelField])).join(',');
  const filter = odataFilter ? `&$filter=${odataFilter}` : '';
  const order = orderBy ? `&$orderby=${orderBy}` : '';
  const items = await fetchAllListItems(listName, `$select=${fields}${filter}${order}&$top=${LIST_PAGE_SIZE}`);

  const seen = new Set<string>();
  const options: IOption[] = [];
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const value = item[valueField];
    if (value === null || value === undefined || value === '') continue;
    const key = String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value: value as string | number, label: (item[labelField] as string) ?? key });
  }

  if (!orderBy) options.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return options;
}
