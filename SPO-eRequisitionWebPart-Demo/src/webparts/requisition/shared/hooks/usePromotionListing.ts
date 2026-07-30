// Generic listing screen state + orchestration, shared by AllPA and AllTA. The component
// renders UI and delegates all state/data work here (see docs/CONVENTIONS.md §6). Parameterised
// by list-set config + the View route prefix so each request type reuses one implementation.

import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';

import {
  IPromotionListingConfig,
  PromotionListingService,
} from '@/shared/services/PromotionListingService';
import { filterPromotionActivities } from '@/shared/utils/promotionListingFilter';
import { exportRowsToCsv, IExportColumn } from '@/shared/utils/exportCsv';
import { FISCAL_MONTH_OPTIONS } from '@/shared/constants/promotionListing';
import { IAllPaFilterState, IOption, IPromotionActivityRow } from '@/shared/types';

/** Calendar month label -> fiscal ordinal (September = 1 … August = 12). */
const FISCAL_ORDINAL_BY_MONTH: Record<string, number> = FISCAL_MONTH_OPTIONS.reduce(
  (acc, option) => {
    acc[option.label] = Number(option.value);
    return acc;
  },
  {} as Record<string, number>,
);

/** Fiscal ordinal for a selected month option (by label first, then value). */
function monthOrdinal(option: IOption | null): number | undefined {
  if (!option) return undefined;
  return FISCAL_ORDINAL_BY_MONTH[option.label] ?? FISCAL_ORDINAL_BY_MONTH[String(option.value)];
}

/** SPFx context published on `window` by RequisitionWebPart.render. */
interface ISpfxWindow {
  _siteUrl?: string;
  __spfxSpHttpClient?: SPHttpClient;
  __mode?: string;
}

export interface IPromotionListingHookConfig extends IPromotionListingConfig {
  /** In-app hash route the View button opens, e.g. '/pa/request' or '/ta/request'. */
  viewRoutePrefix: string;
  /** Base name for the exported CSV file (no extension). */
  exportFileName: string;
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

export interface IUsePromotionListing {
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  filters: IAllPaFilterState;
  channelOptions: IOption[];
  categoryOptions: IOption[];
  rows: IPromotionActivityRow[];
  setFilter: <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]) => void;
  search: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
  view: (row: IPromotionActivityRow) => void;
  exportExcel: () => void;
}

function getSpfxContext(): { spHttpClient: SPHttpClient; siteUrl: string } {
  const spfxWindow = window as unknown as ISpfxWindow;
  const { __spfxSpHttpClient: spHttpClient, _siteUrl: siteUrl } = spfxWindow;
  if (!spHttpClient || !siteUrl) {
    throw new Error('SPFx context is not available on window.');
  }
  return { spHttpClient, siteUrl };
}

/** Numeric (raw, unformatted) export columns — the table's business columns minus View. */
const EXPORT_COLUMNS: IExportColumn<IPromotionActivityRow>[] = [
  { header: 'Status', value: (r) => r.WorkflowStatus?.LookupValue ?? '' },
  { header: 'E-Requisition No.', value: (r) => r.TPMNo },
  { header: 'Transaction', value: (r) => r.Transaction },
  { header: 'Channel', value: (r) => r.CustomerSubGroup?.LookupValue ?? '' },
  { header: 'Promotion Type', value: (r) => r.PromotionType?.LookupValue ?? '' },
  { header: 'Promotion Month', value: (r) => r.PromotionMonth?.LookupValue ?? '' },
  { header: 'Promotion Week', value: (r) => r.PromotionWeek ?? '' },
  { header: 'TI-Committed', value: (r) => r.TotalSpendingTICommitted ?? '' },
  { header: 'TD-Committed', value: (r) => r.TotalSpendingTDCommitted ?? '' },
  { header: 'TI-Committed Adjust', value: (r) => r.TotalSpendingTIAdjust ?? '' },
  { header: 'TD-Committed Adjust', value: (r) => r.TotalSpendingTDAdjust ?? '' },
  { header: 'TI-Utilized', value: (r) => r.TotalSpendingTI ?? '' },
  { header: 'TD-Utilized', value: (r) => r.TotalSpendingTD ?? '' },
  { header: 'Expected to Close', value: (r) => r.ExpectedToClose ?? '' },
  { header: 'Delay', value: (r) => r.Delay ?? '' },
  { header: 'Mechanics Details', value: (r) => r.MechanicsDetails ?? '' },
];

export function usePromotionListing(config: IPromotionListingHookConfig): IUsePromotionListing {
  const [filters, setFilters] = React.useState<IAllPaFilterState>(EMPTY_FILTERS);
  const [channelOptions, setChannelOptions] = React.useState<IOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<IOption[]>([]);
  const [rows, setRows] = React.useState<IPromotionActivityRow[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState<boolean>(false);

  const dataPromiseRef = React.useRef<Promise<IPromotionActivityRow[]> | null>(null);

  const getService = React.useCallback((): PromotionListingService => {
    const { spHttpClient, siteUrl } = getSpfxContext();
    return new PromotionListingService(spHttpClient, siteUrl, {
      detailListName: config.detailListName,
      baseSelect: config.baseSelect,
      channelListName: config.channelListName,
      categoryListName: config.categoryListName,
    });
  }, [config.detailListName, config.baseSelect, config.channelListName, config.categoryListName]);

  const buildViewUrl = React.useCallback(
    (tpmNo: string, transaction: number | string): string => {
      const spfxWindow = window as unknown as ISpfxWindow;
      const siteUrl = spfxWindow._siteUrl ?? '';
      const hash = `#${config.viewRoutePrefix}?_id=${encodeURIComponent(tpmNo)}&_tx=${encodeURIComponent(
        String(transaction),
      )}&mode=view`;
      if (spfxWindow.__mode === 'local') {
        return (
          'https://fusionsoftcompany.sharepoint.com/sites/Project-ABF-eRequisition/SitePages/Requisition.aspx' +
          '?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&debug=true&noredir=true' +
          hash
        );
      }
      return `${siteUrl}/SitePages/Requisition.aspx${hash}`;
    },
    [config.viewRoutePrefix],
  );

  const loadData = React.useCallback(
    (forceRefresh = false): Promise<IPromotionActivityRow[]> => {
      if (forceRefresh) dataPromiseRef.current = null;
      if (!dataPromiseRef.current) {
        dataPromiseRef.current = getService()
          .getAllDetails()
          .catch((err) => {
            dataPromiseRef.current = null;
            throw err;
          });
      }
      return dataPromiseRef.current;
    },
    [getService],
  );

  React.useEffect(() => {
    getService()
      .getFilterOptions()
      .then(({ channels, categories }) => {
        setChannelOptions(channels);
        setCategoryOptions(categories);
      })
      .catch((err) => console.error('[usePromotionListing] failed to load filter options.', err));

    loadData().catch((err) => console.error('[usePromotionListing] cache warm-up failed.', err));
  }, [getService, loadData]);

  const setFilter = React.useCallback(
    <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]): void => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const runSearch = React.useCallback(
    async (forceRefresh: boolean): Promise<void> => {
      // Month-range validation: Promotion Month From must not be later than To (fiscal order).
      const from = monthOrdinal(filters.monthFrom);
      const to = monthOrdinal(filters.monthTo);
      if (from !== undefined && to !== undefined && from > to) {
        setHasSearched(true);
        setRows([]);
        setError('Promotion Month From ต้องไม่มากกว่า Promotion Month To');
        return;
      }

      setIsLoading(true);
      setError(null);
      setHasSearched(true);
      try {
        const data = await loadData(forceRefresh);
        setRows(filterPromotionActivities(data, filters));
      } catch (err) {
        console.error('[usePromotionListing] search failed.', err);
        setRows([]);
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
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
    setError(null);
    setHasSearched(false);
  }, []);

  const view = React.useCallback(
    (row: IPromotionActivityRow): void => {
      window.open(buildViewUrl(row.TPMNo, row.Transaction), '_blank');
    },
    [buildViewUrl],
  );

  const exportExcel = React.useCallback((): void => {
    exportRowsToCsv(config.exportFileName, EXPORT_COLUMNS, rows);
  }, [config.exportFileName, rows]);

  return {
    isLoading,
    error,
    hasSearched,
    filters,
    channelOptions,
    categoryOptions,
    rows,
    setFilter,
    search,
    refresh,
    clear,
    view,
    exportExcel,
  };
}
