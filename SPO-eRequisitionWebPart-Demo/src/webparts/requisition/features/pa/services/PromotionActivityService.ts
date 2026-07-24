// SharePoint REST access for the AllPA listing screen. Components/hooks never call
// SPHttpClient directly (see docs/CONVENTIONS.md §6); they go through this service.

import { SPHttpClient } from '@microsoft/sp-http';

import { LIST_NAMES, LIST_PAGE_SIZE } from '@/features/pa/constants';
import { comparePromotionActivities } from '@/features/pa/utils/promotionActivityFilter';
import {
  IRawPadItem,
  PAD_BASE_SELECT,
  PAD_EXPAND,
  PAD_LOOKUP_SELECT,
  mapRawPadToRow,
} from '@/features/pa/utils/promotionActivityMapper';
import { IOption, IPromotionActivityRow, ISharePointItem } from '@/features/pa/types';
import { fetchAllListItems } from '@/shared/utils/spItems';

/** Filter options sourced from SharePoint master lists for the AllPA screen. */
export interface IAllPaFilterSourceOptions {
  channels: IOption[];
  categories: IOption[];
}

export class PromotionActivityService {
  public constructor(
    private readonly spHttpClient: SPHttpClient,
    private readonly siteUrl: string,
  ) {}

  /** Fetches every item across pages (follows `@odata.nextLink`); throws if any page fails. */
  private async fetchAllPaged(listName: string, query: string): Promise<ISharePointItem[]> {
    return fetchAllListItems(this.spHttpClient, this.siteUrl, listName, query);
  }

  /**
   * Loads every "Promotion Activities Detail" row and normalises it for the listing table.
   *
   * Filtering happens client-side (in the hook): these lists exceed 5,000 items and only
   * `Modified` is indexed, so a server-side `$filter` on Channel/Category/Fiscal throws a
   * list-view-threshold error regardless of how few rows match. We therefore page through
   * the whole list once and let the caller cache the result.
   */
  public async getAllDetails(): Promise<IPromotionActivityRow[]> {
    const query = `$select=${[...PAD_BASE_SELECT, ...PAD_LOOKUP_SELECT].join(
      ',',
    )}&$expand=${PAD_EXPAND}&$top=${LIST_PAGE_SIZE}`;

    const rawItems = await this.fetchAllPaged(LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL, query);

    const rows = rawItems.map((raw) => mapRawPadToRow(raw as unknown as IRawPadItem));

    // Sort once here so both the full set and every filtered subset (filtering preserves
    // order) display by E-Requisition No., then Transaction.
    return rows.sort(comparePromotionActivities);
  }

  /** Maps a master-list to de-duplicated, label-sorted `IOption`s. */
  private async getOptionsFromList(
    listName: string,
    valueField: string,
    labelField: string,
    odataFilter?: string,
  ): Promise<IOption[]> {
    const select = `$select=${valueField},${labelField}`;
    const filter = odataFilter ? `&$filter=${odataFilter}` : '';
    const items = await this.fetchAllPaged(listName, `${select}${filter}&$top=${LIST_PAGE_SIZE}`);

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

    options.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return options;
  }

  /** Loads the Channel and Category dropdown options from their master lists. */
  public async getFilterOptions(): Promise<IAllPaFilterSourceOptions> {
    const [channels, categories] = await Promise.all([
      this.getOptionsFromList(LIST_NAMES.CUSTOMER_SUB_GROUP, 'Nickname', 'Description'),
      this.getOptionsFromList(LIST_NAMES.CATEGORY, 'Description', 'Description', 'Active eq 1'),
    ]);
    return { channels, categories };
  }
}
