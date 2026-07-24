// Owns the AllPA search screen's state and orchestration. The component renders UI and
// delegates every state change / data operation here (see docs/CONVENTIONS.md §6).

import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';

import { PromotionActivityService } from '@/features/pa/services/PromotionActivityService';
import { filterPromotionActivities } from '@/features/pa/utils/promotionActivityFilter';
import { IAllPaFilterState, IOption, IPromotionActivityRow } from '@/features/pa/types';

/** SPFx context published on `window` by RequisitionWebPart.render (see useRequisitionForm). */
interface ISpfxWindow {
  _siteUrl?: string;
  __spfxSpHttpClient?: SPHttpClient;
  __mode?: string;
}

const EMPTY_FILTERS: IAllPaFilterState = {
  channel: null,
  category: null,
  monthFrom: null,
  monthTo: null,
  fiscalYear: null,
  workflowStatus: null,
  eRequisitionNo: null,
  expectedToClose: null,
  promotionWeek: null,
};

export interface IUseAllPaSearch {
  isLoading: boolean;
  filters: IAllPaFilterState;
  channelOptions: IOption[];
  categoryOptions: IOption[];
  rows: IPromotionActivityRow[];
  setFilter: <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]) => void;
  search: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
  view: (row: IPromotionActivityRow) => void;
}

function getService(): PromotionActivityService {
  const spfxWindow = window as unknown as ISpfxWindow;
  const { __spfxSpHttpClient: spHttpClient, _siteUrl: siteUrl } = spfxWindow;
  if (!spHttpClient || !siteUrl) {
    throw new Error('SPFx context is not available on window.');
  }
  return new PromotionActivityService(spHttpClient, siteUrl);
}

/** Builds the URL that opens a single requisition in a new tab (local debug vs. deployed). */
function buildViewUrl(tpmNo: string): string {
  const spfxWindow = window as unknown as ISpfxWindow;
  const siteUrl = spfxWindow._siteUrl ?? '';
  if (spfxWindow.__mode === 'local') {
    return (
      'https://fusionsoftcompany.sharepoint.com/sites/Project-ABF-eRequisition/SitePages/Requisition.aspx' +
      '?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&debug=true&noredir=true' +
      `#/pa/request?_id=${tpmNo}`
    );
  }
  return `${siteUrl}/SitePages/Requisition.aspx#/pa/request?_id=${tpmNo}`;
}

export function useAllPaSearch(): IUseAllPaSearch {
  const [filters, setFilters] = React.useState<IAllPaFilterState>(EMPTY_FILTERS);
  const [channelOptions, setChannelOptions] = React.useState<IOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<IOption[]>([]);
  const [rows, setRows] = React.useState<IPromotionActivityRow[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // Cache of the full Detail dataset. A single in-flight promise is reused so concurrent
  // Search clicks (and the on-mount warm-up) share one fetch instead of re-downloading
  // all ~9,900 rows every time. `refresh()` clears it to force a re-pull.
  const dataPromiseRef = React.useRef<Promise<IPromotionActivityRow[]> | null>(null);

  const loadData = React.useCallback((forceRefresh = false): Promise<IPromotionActivityRow[]> => {
    if (forceRefresh) dataPromiseRef.current = null;
    if (!dataPromiseRef.current) {
      dataPromiseRef.current = getService()
        .getAllDetails()
        .catch((error) => {
          dataPromiseRef.current = null; // allow a retry on the next Search
          throw error;
        });
    }
    return dataPromiseRef.current;
  }, []);

  // Load Channel/Category options and warm the data cache in the background on mount, so the
  // first Search click filters an already-fetched dataset instead of waiting on the network.
  React.useEffect(() => {
    const service = getService();
    service
      .getFilterOptions()
      .then(({ channels, categories }) => {
        setChannelOptions(channels);
        setCategoryOptions(categories);
      })
      .catch((error) => console.error('[useAllPaSearch] failed to load filter options.', error));

    loadData().catch((error) => console.error('[useAllPaSearch] cache warm-up failed.', error));
  }, [loadData]);

  const setFilter = React.useCallback(
    <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]): void => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const runSearch = React.useCallback(
    async (forceRefresh: boolean): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await loadData(forceRefresh);
        setRows(filterPromotionActivities(data, filters));
      } catch (error) {
        console.error('[useAllPaSearch] search failed.', error);
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, loadData],
  );

  const search = React.useCallback(() => runSearch(false), [runSearch]);
  const refresh = React.useCallback(() => runSearch(true), [runSearch]);

  const clear = React.useCallback((): void => {
    setFilters(EMPTY_FILTERS);
    setRows([]);
  }, []);

  const view = React.useCallback((row: IPromotionActivityRow): void => {
    window.open(buildViewUrl(row.TPMNo), '_blank');
  }, []);

  return {
    isLoading,
    filters,
    channelOptions,
    categoryOptions,
    rows,
    setFilter,
    search,
    refresh,
    clear,
    view,
  };
}
