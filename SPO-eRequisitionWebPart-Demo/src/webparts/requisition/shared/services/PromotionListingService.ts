// Shared SharePoint REST access for the promotion/trade-agreement listing screens.
// Parameterised by list-set config so AllPA (Promotion Activities Detail) and AllTA
// (TA Detail) reuse one implementation. Components/hooks never call axios directly.

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
import { fetchFiscalYearOptions } from '@/shared/services/FiscalYearService';

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
  fiscalYears: IOption[];
}

/**
 * Selections translated into a server-side `$filter`, built entirely from what the caller
 * already knows about the current selection (this service has no notion of "all options" or
 * fiscal-month ordinals itself — see usePromotionListing for how each field is derived).
 * Every field here is still re-applied client-side afterward (filterPromotionActivities), so a
 * clause that doesn't behave as expected on a given tenant degrades to "no server-side help for
 * this field", never to a wrong result.
 */
export interface IPromotionListingServerFilters {
  /** Selected channel labels; omit/empty = no constraint (e.g. every channel is selected). */
  channel?: string[];
  /** Selected category labels; omit/empty = no constraint. */
  category?: string[];
  fiscalYear?: string;
  workflowStatus?: string;
  eRequisitionNo?: string;
  expectedToClose?: string;
  /** Calendar month names (e.g. "July") covered by the selected fiscal Promotion Month range. */
  promotionMonths?: string[];
  /** 'W1-2' or 'W3-4'; omit = no constraint (covers "All" and no selection). */
  promotionWeek?: 'W1-2' | 'W3-4';
}

/** Escapes a single quote for embedding in an OData string literal (`'` -> `''`). */
function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

/** `field eq 'a'` for one value, or `(field eq 'a' or field eq 'b' or ...)` for several. */
function orEqClause(field: string, values: string[]): string {
  const parts = values.map((value) => `${field} eq '${escapeODataString(value)}'`);
  return parts.length > 1 ? `(${parts.join(' or ')})` : parts[0];
}

/** Builds an OData `$filter` clause from whichever server filters have a value, ANDed together. */
function buildODataFilter(filters: IPromotionListingServerFilters): string {
  const clauses: string[] = [];
  if (filters.channel && filters.channel.length > 0) {
    clauses.push(orEqClause('CustomerSubGroup/Description', filters.channel));
  }
  if (filters.category && filters.category.length > 0) {
    clauses.push(orEqClause('Category/Description', filters.category));
  }
  if (filters.fiscalYear) clauses.push(`Fiscal eq '${escapeODataString(filters.fiscalYear)}'`);
  if (filters.workflowStatus) {
    clauses.push(`WorkflowStatus/Title eq '${escapeODataString(filters.workflowStatus)}'`);
  }
  if (filters.eRequisitionNo) clauses.push(`TPMNo eq '${escapeODataString(filters.eRequisitionNo)}'`);
  if (filters.expectedToClose) {
    clauses.push(`ExpectedToClose eq '${escapeODataString(filters.expectedToClose)}'`);
  }
  if (filters.promotionMonths && filters.promotionMonths.length > 0) {
    clauses.push(orEqClause('PromotionMonth/Description', filters.promotionMonths));
  }
  if (filters.promotionWeek === 'W1-2') clauses.push('W1_x002d_2 eq 1');
  if (filters.promotionWeek === 'W3-4') clauses.push('W3_x002d_4 eq 1');
  return clauses.join(' and ');
}

export class PromotionListingService {
  public constructor(private readonly config: IPromotionListingConfig) {}

  /**
   * Loads Detail rows for the configured list and normalises them for the listing table.
   * These lists exceed 5,000 items and only `Modified` is indexed, so a server-side `$filter`
   * built from unindexed columns can throw a list-view-threshold error — when `serverFilters`
   * produces a non-empty clause, this tries the filtered query first and falls back to the full
   * unfiltered page-all fetch (client-side filtering then narrows it, same as before) if that
   * throws.
   */
  public async getAllDetails(serverFilters?: IPromotionListingServerFilters): Promise<IPromotionActivityRow[]> {
    const selectExpandTop = `$select=${[...this.config.baseSelect, ...PAD_LOOKUP_SELECT].join(
      ',',
    )}&$expand=${PAD_EXPAND}&$top=${LIST_PAGE_SIZE}`;
    const filterClause = serverFilters ? buildODataFilter(serverFilters) : '';

    let rawItems;
    if (filterClause) {
      try {
        rawItems = await fetchAllListItems(this.config.detailListName, `${selectExpandTop}&$filter=${filterClause}`);
      } catch {
        rawItems = await fetchAllListItems(this.config.detailListName, selectExpandTop);
      }
    } else {
      rawItems = await fetchAllListItems(this.config.detailListName, selectExpandTop);
    }

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
    const items = await fetchAllListItems(listName, `${select}${filter}&$top=${LIST_PAGE_SIZE}`);

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

  /** Loads the SharePoint-backed dropdown options used by the listing filters. */
  public async getFilterOptions(): Promise<IPromotionListingFilterOptions> {
    const [channels, categories, fiscalYears] = await Promise.all([
      this.getOptionsFromList(this.config.channelListName, 'Nickname', 'Description'),
      this.getOptionsFromList(this.config.categoryListName, 'Description', 'Description', 'Active eq 1'),
      fetchFiscalYearOptions(),
    ]);
    return { channels, categories, fiscalYears };
  }
}
