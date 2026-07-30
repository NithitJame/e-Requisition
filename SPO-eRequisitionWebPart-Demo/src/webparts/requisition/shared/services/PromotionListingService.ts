// Shared SharePoint REST access for the promotion/trade-agreement listing screens.
// Parameterised by list-set config so AllPA (Promotion Activities Detail) and AllTA
// (TA Detail) reuse one implementation. Components/hooks never call SPHttpClient directly.

import { SPHttpClient } from '@microsoft/sp-http';

import { LIST_PAGE_SIZE } from '@/shared/constants/promotionListing';
import { comparePromotionActivities } from '@/shared/utils/promotionListingFilter';
import {
  IRawPadItem,
  PAD_EXPAND,
  PAD_LOOKUP_SELECT,
  mapRawPadToRow,
} from '@/shared/utils/promotionListingMapper';
import { fetchAllListItems } from '@/shared/utils/spItems';
import { IOption, IPromotionActivityRow } from '@/shared/types';

/** List-set configuration that adapts the service to a request type (PA vs TA). */
export interface IPromotionListingConfig {
  /** Detail list to read rows from (e.g. "Promotion Activities Detail" / "TA Detail"). */
  detailListName: string;
  /** Base $select fields (PA includes …Adjust; TA omits them). */
  baseSelect: string[];
  /** Channel master list (e.g. "M_CustomerSubGroup"). */
  channelListName: string;
  /** Category master list (e.g. "M_Category"). */
  categoryListName: string;
}

/** Filter options sourced from SharePoint master lists. */
export interface IPromotionListingFilterOptions {
  channels: IOption[];
  categories: IOption[];
}

export class PromotionListingService {
  public constructor(
    private readonly spHttpClient: SPHttpClient,
    private readonly siteUrl: string,
    private readonly config: IPromotionListingConfig,
  ) {}

  /**
   * Loads every Detail row for the configured list and normalises it for the listing table.
   * Filtering happens client-side (these lists exceed 5,000 items and only `Modified` is
   * indexed), so we page the whole list once and let the caller cache the result.
   */
  public async getAllDetails(): Promise<IPromotionActivityRow[]> {
    const query = `$select=${[...this.config.baseSelect, ...PAD_LOOKUP_SELECT].join(
      ',',
    )}&$expand=${PAD_EXPAND}&$top=${LIST_PAGE_SIZE}`;

    const rawItems = await fetchAllListItems(
      this.spHttpClient,
      this.siteUrl,
      this.config.detailListName,
      query,
    );
    const rows = rawItems.map((raw) => mapRawPadToRow(raw as unknown as IRawPadItem));
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
    const items = await fetchAllListItems(
      this.spHttpClient,
      this.siteUrl,
      listName,
      `${select}${filter}&$top=${LIST_PAGE_SIZE}`,
    );

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
  public async getFilterOptions(): Promise<IPromotionListingFilterOptions> {
    const [channels, categories] = await Promise.all([
      this.getOptionsFromList(this.config.channelListName, 'Nickname', 'Description'),
      this.getOptionsFromList(this.config.categoryListName, 'Description', 'Description', 'Active eq 1'),
    ]);
    return { channels, categories };
  }
}
