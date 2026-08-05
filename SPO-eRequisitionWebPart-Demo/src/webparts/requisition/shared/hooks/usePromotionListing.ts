// Generic listing screen state + orchestration, shared by AllPA and AllTA. The component
// renders UI and delegates all state/data work here (see docs/CONVENTIONS.md §6). Parameterised
// by list-set config + the View route prefix so each request type reuses one implementation.

import * as React from 'react';

import {
  IPromotionListingConfig,
  IPromotionListingServerFilters,
  PromotionListingService,
} from '@/shared/services/PromotionListingService';
import {
  buildERequisitionNoOptions,
  filterPromotionActivities,
  getMonthRangeError,
} from '@/shared/utils/promotionListingFilter';
import { exportRowsToCsv, IExportColumn } from '@/shared/utils/exportCsv';
import { multiSelectSummary, singleSelectSummary } from '@/shared/utils/filterSummary';
import { getCurrentFiscalYearValue } from '@/shared/utils/fiscalYear';
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

/** Fiscal ordinal -> calendar month label (the reverse of FISCAL_ORDINAL_BY_MONTH). */
const MONTH_LABEL_BY_FISCAL_ORDINAL: Record<number, string> = FISCAL_MONTH_OPTIONS.reduce(
  (acc, option) => {
    acc[Number(option.value)] = option.label;
    return acc;
  },
  {} as Record<number, string>,
);

/** Fiscal ordinal for a selected month option (by label first, then value). */
function monthOrdinal(option: IOption | null): number | undefined {
  if (!option) return undefined;
  return FISCAL_ORDINAL_BY_MONTH[option.label] ?? FISCAL_ORDINAL_BY_MONTH[String(option.value)];
}

/** Calendar month names for every fiscal ordinal in `[from, to]` (inclusive). */
function monthsInFiscalRange(from: number, to: number): string[] {
  const months: string[] = [];
  for (let ordinal = from; ordinal <= to; ordinal++) {
    const label = MONTH_LABEL_BY_FISCAL_ORDINAL[ordinal];
    if (label) months.push(label);
  }
  return months;
}

/** True when every currently-loaded option is selected (or none are) — i.e. "no constraint". */
function isEverythingSelected(selected: IOption[] | null, allOptions: IOption[]): boolean {
  if (!selected || selected.length === 0) return true;
  return allOptions.length > 0 && selected.length === allOptions.length;
}

/** SPFx context published on `window` by RequisitionWebPart.render. */
interface ISpfxWindow {
  _siteUrl?: string;
  __mode?: string;
}

export interface IPromotionListingHookConfig extends IPromotionListingConfig {
  /** In-app hash route the View button opens, e.g. '/pa/request' or '/ta/request'. */
  viewRoutePrefix: string;
  /** Base name for the exported CSV file (no extension). */
  exportFileName: string;
  /**
   * Pre-select every Category on first load (default true). Set false where the Category
   * filter is hidden (AllTA) so it doesn't silently exclude rows with inactive categories.
   */
  defaultAllCategory?: boolean;
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
  fiscalYearOptions: IOption[];
  monthOptions: IOption[];
  workflowStatusOptions: IOption[];
  eRequisitionNoOptions: IOption[];
  rows: IPromotionActivityRow[];
  /** Set as soon as Month From/To form an invalid (reversed) fiscal range — before Search. */
  monthRangeError: string | null;
  setFilter: <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]) => void;
  /** Always pulls fresh data from SharePoint before filtering (there is no separate Refresh). */
  search: () => Promise<void>;
  clear: () => void;
  view: (row: IPromotionActivityRow) => void;
  exportExcel: () => void;
}

/** Numeric (raw, unformatted) export columns — the table's business columns minus View. */
const EXPORT_COLUMNS: IExportColumn<IPromotionActivityRow>[] = [
  { header: 'Status', value: (r) => r.WorkflowStatus?.LookupValue ?? '' },
  { header: 'Category', value: (r) => r.Category.map((c) => c.LookupValue).join(', ') },
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
  const [fiscalYearOptions, setFiscalYearOptions] = React.useState<IOption[]>([]);
  const [monthOptions, setMonthOptions] = React.useState<IOption[]>([]);
  const [workflowStatusOptions, setWorkflowStatusOptions] = React.useState<IOption[]>([]);
  const [eRequisitionNoOptions, setERequisitionNoOptions] = React.useState<IOption[]>([]);
  const [rows, setRows] = React.useState<IPromotionActivityRow[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState<boolean>(false);

  const dataPromiseRef = React.useRef<Promise<IPromotionActivityRow[]> | null>(null);
  // Applies the "all channels/categories selected by default" once, when options first load.
  const defaultFiltersAppliedRef = React.useRef<boolean>(false);

  const getService = React.useCallback((): PromotionListingService => {
    return new PromotionListingService({
      detailListName: config.detailListName,
      baseSelect: config.baseSelect,
      channelListName: config.channelListName,
      categoryListName: config.categoryListName,
      workflowStatusModule: config.workflowStatusModule,
    });
  }, [
    config.detailListName,
    config.baseSelect,
    config.channelListName,
    config.categoryListName,
    config.workflowStatusModule,
  ]);

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
    (forceRefresh = false, serverFilters?: IPromotionListingServerFilters): Promise<IPromotionActivityRow[]> => {
      if (forceRefresh) dataPromiseRef.current = null;
      if (!dataPromiseRef.current) {
        dataPromiseRef.current = getService()
          .getAllDetails(serverFilters)
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
      .then(({ channels, categories, fiscalYears, months, workflowStatuses }) => {
        setChannelOptions(channels);
        setCategoryOptions(categories);
        setFiscalYearOptions(fiscalYears);
        setMonthOptions(months);
        setWorkflowStatusOptions(workflowStatuses);
        if (!defaultFiltersAppliedRef.current) {
          defaultFiltersAppliedRef.current = true;
          const currentFiscalYear =
            fiscalYears.find((option) => option.value === getCurrentFiscalYearValue()) ?? null;
          setFilters((prev) => ({
            ...prev,
            channel: channels,
            fiscalYear: currentFiscalYear,
            ...(config.defaultAllCategory !== false ? { category: categories } : {}),
          }));
        }
      })
      .catch((err) => console.error('[usePromotionListing] failed to load filter options.', err));

    loadData()
      .then((data) => setERequisitionNoOptions(buildERequisitionNoOptions(data)))
      .catch((err) => console.error('[usePromotionListing] cache warm-up failed.', err));
  }, [getService, loadData]);

  const setFilter = React.useCallback(
    <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]): void => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Reacts to every Month From/To change so the field-level error shows immediately, rather
  // than waiting for Search to be pressed.
  const monthRangeError = React.useMemo(
    (): string | null => getMonthRangeError(filters.monthFrom, filters.monthTo),
    [filters.monthFrom, filters.monthTo],
  );

  /**
   * Translates the current selection into a server-side `$filter` (see
   * PromotionListingService.getAllDetails for how each field turns into OData). Channel/Category
   * are omitted when every currently-loaded option is selected — the common default state — so
   * the query doesn't grow a long OR clause for "no constraint".
   */
  const buildServerFilters = React.useCallback((): IPromotionListingServerFilters => {
    const monthFromOrdinal = monthOrdinal(filters.monthFrom);
    const monthToOrdinal = monthOrdinal(filters.monthTo);
    const hasMonthRange = monthFromOrdinal !== undefined || monthToOrdinal !== undefined;

    return {
      channel: isEverythingSelected(filters.channel, channelOptions)
        ? undefined
        : (filters.channel ?? []).map((option) => option.label),
      category: isEverythingSelected(filters.category, categoryOptions)
        ? undefined
        : (filters.category ?? []).map((option) => option.label),
      fiscalYear: filters.fiscalYear ? String(filters.fiscalYear.value) : undefined,
      workflowStatus: filters.workflowStatus ? String(filters.workflowStatus.value) : undefined,
      eRequisitionNo: filters.eRequisitionNo ? String(filters.eRequisitionNo.value) : undefined,
      expectedToClose: filters.expectedToClose ? String(filters.expectedToClose.value) : undefined,
      promotionMonths: hasMonthRange ? monthsInFiscalRange(monthFromOrdinal ?? 1, monthToOrdinal ?? 12) : undefined,
      promotionWeek:
        filters.promotionWeek === 'W1-2' || filters.promotionWeek === 'W3-4' ? filters.promotionWeek : undefined,
    };
  }, [filters, channelOptions, categoryOptions]);

  const search = React.useCallback(async (): Promise<void> => {
    // Month-range validation is also shown inline (monthRangeError) as soon as it's wrong;
    // this is the last-resort guard so Search never runs against an invalid range.
    if (monthRangeError) {
      setHasSearched(true);
      setRows([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      // There is no separate Refresh action, so Search always pulls fresh data from
      // SharePoint (bypasses the warm-up cache) before filtering. Every filter that can be
      // expressed as a server-side $filter is pushed to SharePoint first, so a narrow search
      // doesn't have to page through the entire list; filterPromotionActivities is still
      // applied afterward as the source of truth regardless of what the server returned.
      const data = await loadData(true, buildServerFilters());
      setERequisitionNoOptions(buildERequisitionNoOptions(data));
      setRows(filterPromotionActivities(data, filters));
    } catch (err) {
      console.error('[usePromotionListing] search failed.', err);
      setRows([]);
      setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  }, [filters, loadData, buildServerFilters, monthRangeError]);

  const clear = React.useCallback((): void => {
    // Bottom "Clear" resets every filter EXCEPT Channel/Category (both default to "all
    // selected" and have no dedicated Clear of their own besides the one next to Channel).
    setFilters((prev) => ({ ...EMPTY_FILTERS, channel: prev.channel, category: prev.category }));
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
    const summaryBlock: Array<[string, string]> = [
      ['Channel', multiSelectSummary(filters.channel, channelOptions)],
      ['Category', multiSelectSummary(filters.category, categoryOptions)],
      ['Fiscal Year', singleSelectSummary(filters.fiscalYear)],
      ['Promotion Month From', singleSelectSummary(filters.monthFrom)],
      ['Promotion Month To', singleSelectSummary(filters.monthTo)],
      ['Status', singleSelectSummary(filters.workflowStatus)],
      ['E-Requisition No.', singleSelectSummary(filters.eRequisitionNo)],
      ['Expected to Close', singleSelectSummary(filters.expectedToClose)],
      ['Promotion Week', filters.promotionWeek ?? 'All'],
    ];
    exportRowsToCsv(config.exportFileName, EXPORT_COLUMNS, rows, summaryBlock);
  }, [config.exportFileName, rows, filters, channelOptions, categoryOptions]);

  return {
    isLoading,
    error,
    hasSearched,
    filters,
    channelOptions,
    categoryOptions,
    fiscalYearOptions,
    monthOptions,
    workflowStatusOptions,
    eRequisitionNoOptions,
    rows,
    monthRangeError,
    setFilter,
    search,
    clear,
    view,
    exportExcel,
  };
}
