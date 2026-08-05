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
import api, { getSiteUrl } from '@/shared/services/api';
import { IOption, IPromotionActivityRow, ISharePointItem } from '@/shared/types';
import { fetchFiscalYearOptions } from '@/shared/services/FiscalYearService';
import { fetchMasterListOptions } from '@/shared/services/masterListOptions';
import { fetchMonthOptions } from '@/shared/services/MonthService';
import { fetchWorkflowStatusOptions, TWorkflowStatusModule } from '@/shared/services/WorkflowStatusService';

/**
 * Id-range width for a filtered chunk. `Id` is always indexed, so bounding a query to
 * `Id ge x and Id le y` lets SharePoint narrow the scan to this range before evaluating the
 * rest of the (possibly unindexed / lookup-field) filter — comfortably under the 5,000-item
 * list-view threshold, regardless of what the rest of the filter touches.
 */
const ID_CHUNK_SIZE = 4500;

/** Cheaply reads the highest `Id` currently in the list (single row, ordered by the Id index). */
async function getMaxItemId(listName: string): Promise<number> {
  const url = `${getSiteUrl()}/_api/web/lists/GetByTitle('${listName}')/items?$select=Id&$top=1&$orderby=Id desc`;
  const response = await api.get<{ value?: Array<{ Id?: number }> }>(url);
  const maxId = response.data.value?.[0]?.Id;
  return typeof maxId === 'number' ? maxId : 0;
}

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
  /** Which M_WorkflowStatus boolean column marks a status as applicable to this request type. */
  workflowStatusModule: TWorkflowStatusModule;
}

/** Filter options sourced from SharePoint master lists. */
export interface IPromotionListingFilterOptions {
  channels: IOption[];
  categories: IOption[];
  fiscalYears: IOption[];
  months: IOption[];
  workflowStatuses: IOption[];
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
   * built from unindexed columns can throw a list-view-threshold error if evaluated over the
   * whole list at once — when `serverFilters` produces a non-empty clause, this instead runs it
   * in `Id`-bounded chunks (see fetchFilteredByIdChunks) so each request scans a bounded slice,
   * and falls back to the full unfiltered page-all fetch (client-side filtering then narrows it,
   * same as before) if that still throws for any reason.
   */
  public async getAllDetails(serverFilters?: IPromotionListingServerFilters): Promise<IPromotionActivityRow[]> {
    const selectExpandTop = `$select=${[...this.config.baseSelect, ...PAD_LOOKUP_SELECT].join(
      ',',
    )}&$expand=${PAD_EXPAND}&$top=${LIST_PAGE_SIZE}`;
    const filterClause = serverFilters ? buildODataFilter(serverFilters) : '';

    let rawItems: ISharePointItem[];
    if (filterClause) {
      try {
        rawItems = await this.fetchFilteredByIdChunks(selectExpandTop, filterClause);
      } catch {
        rawItems = await fetchAllListItems(this.config.detailListName, selectExpandTop);
      }
    } else {
      rawItems = await fetchAllListItems(this.config.detailListName, selectExpandTop);
    }

    const rows = rawItems.map((raw) => mapRawPadToRow(raw as unknown as IRawPadItem));
    return rows.sort(comparePromotionActivities);
  }

  /**
   * Runs a `$filter` in sequential `Id`-range chunks instead of over the whole list at once, so
   * each request's scan is bounded by an indexed column regardless of what the rest of the
   * filter touches (lookup fields included). Requests run one at a time (not in parallel) to
   * avoid piling many large queries onto SharePoint at once.
   */
  private async fetchFilteredByIdChunks(selectExpandTop: string, filterClause: string): Promise<ISharePointItem[]> {
    const maxId = await getMaxItemId(this.config.detailListName);
    if (maxId <= 0) return [];

    const items: ISharePointItem[] = [];
    for (let start = 1; start <= maxId; start += ID_CHUNK_SIZE) {
      const end = Math.min(start + ID_CHUNK_SIZE - 1, maxId);
      const chunkFilter = `(Id ge ${start} and Id le ${end}) and (${filterClause})`;
      const chunkItems = await fetchAllListItems(this.config.detailListName, `${selectExpandTop}&$filter=${chunkFilter}`);
      items.push(...chunkItems);
    }
    return items;
  }

  /** Loads the SharePoint-backed dropdown options used by the listing filters. */
  public async getFilterOptions(): Promise<IPromotionListingFilterOptions> {
    const [channels, categories, fiscalYears, months, workflowStatuses] = await Promise.all([
      fetchMasterListOptions({ listName: this.config.channelListName, valueField: 'Nickname', labelField: 'Description' }),
      fetchMasterListOptions({
        listName: this.config.categoryListName,
        valueField: 'Description',
        labelField: 'Description',
        odataFilter: 'Active eq 1',
      }),
      fetchFiscalYearOptions(),
      fetchMonthOptions(),
      fetchWorkflowStatusOptions(this.config.workflowStatusModule),
    ]);
    return { channels, categories, fiscalYears, months, workflowStatuses };
  }
}
