// Owns RequestPA form state and orchestration. Components render UI and delegate
// every state change / data operation here (see docs/CONVENTIONS.md §6).

import * as React from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { ILookupIdMaps, IRequisitionSaveHeader, RequisitionService } from '@/features/pa/services/RequisitionService';
import { buildERequisitionNo, buildTpmNo } from '@/features/pa/utils/eRequisitionNumber';
import { calculateSpendingTotals } from '@/features/pa/utils/totals';
import { mapRawDataToForm } from '@/features/pa/utils/requisitionMapper';
import { buildMockRawData } from '@/features/pa/utils/mockTemplateMapper';
import { validateRequisition } from '@/features/pa/utils/requisitionValidation';
import { showErrorAlert, showPromotionExistsAlert, showSuccessAlert, showWarningAlert } from '@/shared/utils/notify';
import {
  createEmptyChargeToCBURow,
  createEmptyExpenseRow,
  createEmptyTransaction,
} from '@/features/pa/utils/requisitionFactory';
import { DRAFT_STATUS } from '@/features/pa/constants';
import { expenseOptions } from '@/features/pa/constants/filterOptions';
import { fetchChannelOptions } from '@/shared/services/ChannelService';
import { fetchMonthOptions } from '@/shared/services/MonthService';
import { fetchCategoryOptions } from '@/shared/services/CategoryService';
import { fetchPromotionTypeOptions } from '@/shared/services/PromotionTypeService';
import {
  IExpenseOption,
  IMajorGroupOption,
  IOption,
  IRequisitionFormHandlers,
  IRequisitionOptionSet,
  IRequisitionTransaction,
  ITransactionRow,
  TFormAction,
} from '@/features/pa/types';

export interface IUseRequisitionForm {
  isLoading: boolean;
  disabledAction: boolean;
  /** Transaction number selected from the list (view mode) to highlight, or null. */
  selectedTransaction: number | null;
  /** Set when loading an existing e-Requisition failed. */
  loadError: string | null;
  /** True in view mode when no matching e-Requisition was found / not accessible. */
  notFound: boolean;
  transactions: IRequisitionTransaction[];
  channel: IOption | null;
  channelOptions: IOption[];
  fiscalYear: IOption | null;
  fiscalYearOptions: IOption[];
  promotionMonth: IOption | null;
  monthOptions: IOption[];
  majorGroupOptions: IMajorGroupOption[];
  promotionOptions: IOption[];
  categoryOptions: IOption[];
  eRequisitionNo: string;
  totalSpendingTI: number;
  totalSpendingTD: number;
  setChannel: (option: IOption | null) => void;
  setFiscalYear: (option: IOption | null) => void;
  setPromotionMonth: (option: IOption | null) => void;
  handlers: IRequisitionFormHandlers;
  save: (action: TFormAction) => Promise<void>;
  loadMockData: (fiscalYear: string, fiscalMonth: string) => void;
  /** Returns to the All Promotion Activities list (closes the view tab when opened as one). */
  goBack: () => void;
}

function createOptionSet(
  fiscalYears: IOption[],
  channels: IOption[],
  months: IOption[],
  majorGroups: IMajorGroupOption[],
  promotionTypes: IOption[],
  categories: IOption[],
): IRequisitionOptionSet {
  return {
    channelOptions: channels,
    fiscalYearOptions: fiscalYears,
    monthOptions: months,
    promotionOptions: promotionTypes,
    categoryOptions: categories,
    expenseOptions,
    majorGroupOptions: majorGroups,
  };
}

function getService(): RequisitionService {
  return new RequisitionService();
}

/** Reads a query param from the HashRouter URL (search first, then raw hash). */
function readQueryParam(search: string, key: string): string | null {
  const fromSearch = new URLSearchParams(search).get(key);
  if (fromSearch) return fromSearch;

  const rawHash = window.location.hash || '';
  const queryIndex = rawHash.indexOf('?');
  if (queryIndex === -1) return null;
  return new URLSearchParams(rawHash.substring(queryIndex)).get(key);
}

export function useRequisitionForm(): IUseRequisitionForm {
  const history = useHistory();
  const location = useLocation();

  const [transactions, setTransactions] = React.useState<IRequisitionTransaction[]>([]);
  const [channel, setChannel] = React.useState<IOption | null>(null);
  const [channelOptions, setChannelOptions] = React.useState<IOption[]>([]);
  const [fiscalYear, setFiscalYear] = React.useState<IOption | null>(null);
  const [fiscalYearOptions, setFiscalYearOptions] = React.useState<IOption[]>([]);
  const [promotionMonth, setPromotionMonth] = React.useState<IOption | null>(null);
  const [monthOptions, setMonthOptions] = React.useState<IOption[]>([]);
  const [majorGroupOptions, setMajorGroupOptions] = React.useState<IMajorGroupOption[]>([]);
  const [promotionOptions, setPromotionOptions] = React.useState<IOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<IOption[]>([]);
  const [eRequisitionNo, setERequisitionNo] = React.useState<string>('');
  const [totalSpendingTI, setTotalSpendingTI] = React.useState<number>(0);
  const [totalSpendingTD, setTotalSpendingTD] = React.useState<number>(0);
  const [disabledAction, setDisabledAction] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [selectedTransaction, setSelectedTransaction] = React.useState<number | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState<boolean>(false);
  const lookupMapsRef = React.useRef<ILookupIdMaps | null>(null);
  // Last TPMNo the existence check ran for, to avoid re-checking the same selection.
  const lastCheckedTpmNoRef = React.useRef<string>('');

  const loadRequisition = async (
    id: string,
    fiscalYears = fiscalYearOptions,
    channels = channelOptions,
    months = monthOptions,
    majorGroups = majorGroupOptions,
    promotionTypes = promotionOptions,
    categories = categoryOptions,
  ): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const service = getService();
      const [raw, loadedFiscalYears, loadedChannels, loadedMonths, loadedMajorGroups, loadedPromotionTypes, loadedCategories] =
        await Promise.all([
          service.getRequisitionRawData(id),
          fiscalYears.length > 0 ? Promise.resolve(fiscalYears) : service.getFiscalYearOptions(),
          channels.length > 0 ? Promise.resolve(channels) : fetchChannelOptions(),
          months.length > 0 ? Promise.resolve(months) : fetchMonthOptions(),
          majorGroups.length > 0 ? Promise.resolve(majorGroups) : service.getMajorGroupOptions(),
          promotionTypes.length > 0 ? Promise.resolve(promotionTypes) : fetchPromotionTypeOptions(),
          categories.length > 0 ? Promise.resolve(categories) : fetchCategoryOptions(),
        ]);
      setFiscalYearOptions(loadedFiscalYears);
      setChannelOptions(loadedChannels);
      setMonthOptions(loadedMonths);
      setMajorGroupOptions(loadedMajorGroups);
      setPromotionOptions(loadedPromotionTypes);
      setCategoryOptions(loadedCategories);
      const mapped = mapRawDataToForm(
        id,
        raw,
        createOptionSet(
          loadedFiscalYears,
          loadedChannels,
          loadedMonths,
          loadedMajorGroups,
          loadedPromotionTypes,
          loadedCategories,
        ),
      );
      // Empty result = the id does not exist or the user cannot access it (item-level
      // permissions). Surface a clear "not found" rather than a blank form.
      if (mapped.transactions.length === 0) {
        setNotFound(true);
        return;
      }
      setChannel(mapped.channel);
      setFiscalYear(mapped.fiscalYear);
      setPromotionMonth(mapped.promotionMonth);
      setERequisitionNo(id);
      setTotalSpendingTI(mapped.totalSpendingTI);
      setTotalSpendingTD(mapped.totalSpendingTD);
      setTransactions(mapped.transactions);
    } catch (error) {
      console.error('Error loading requisition data:', error);
      setLoadError('ไม่สามารถโหลดข้อมูล e-Requisition ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Dev-only: fills the form from the bundled template for the chosen fiscal period
   * (Mock Data Seeder, Option A). Reuses the production mapper; performs no SharePoint
   * read or write. eRequisitionNo + totals are recomputed by the sync effect below
   * (disabledAction is false on a new requisition).
   */
  const loadMockData = (fiscalYearValue: string, fiscalMonthValue: string): void => {
    const { tpmNo, rawData } = buildMockRawData(fiscalYearValue, fiscalMonthValue);
    const mapped = mapRawDataToForm(
      tpmNo,
      rawData,
      createOptionSet(fiscalYearOptions, channelOptions, monthOptions, majorGroupOptions, promotionOptions, categoryOptions),
    );
    setChannel(mapped.channel);
    setFiscalYear(mapped.fiscalYear);
    setPromotionMonth(mapped.promotionMonth);
    setTransactions(mapped.transactions);
  };

  /**
   * Auto-detect an existing promotion once Channel + Fiscal Year + Promotion Month are all
   * chosen. If one exists for the TPM number, load it into the form for editing and notify the
   * user. The loaded rows carry their SharePoint ids, so saving updates them in place rather
   * than creating duplicates (see RequisitionService.saveRequisition).
   */
  const checkExistingPromotion = async (tpmNo: string): Promise<void> => {
    setIsLoading(true);
    try {
      const exists = await getService().promotionExists(tpmNo);
      if (lastCheckedTpmNoRef.current !== tpmNo) return; // selection changed during fetch
      if (!exists) return; // new period -> save will create
      const raw = await getService().getRequisitionRawData(tpmNo);
      if (lastCheckedTpmNoRef.current !== tpmNo) return;
      const mapped = mapRawDataToForm(
        tpmNo,
        raw,
        createOptionSet(fiscalYearOptions, channelOptions, monthOptions, majorGroupOptions, promotionOptions, categoryOptions),
      );
      setChannel(mapped.channel);
      setFiscalYear(mapped.fiscalYear);
      setPromotionMonth(mapped.promotionMonth);
      setTransactions(mapped.transactions);
      setTotalSpendingTI(mapped.totalSpendingTI);
      setTotalSpendingTD(mapped.totalSpendingTD);
      showPromotionExistsAlert(tpmNo);
    } catch (error) {
      console.error('Error checking existing promotion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Preload lookup id maps once so save/submit can resolve each lookup's display value to
  // its master-list id without adding master-list fetches to the (timed) submit path.
  React.useEffect(() => {
    try {
      void getService()
        .loadLookupIdMaps()
        .then((maps) => {
          lookupMapsRef.current = maps;
        })
        .catch((error) => console.error('Error loading lookup id maps:', error));
    } catch (error) {
      console.error('SPFx context unavailable for lookup id maps:', error);
    }
  }, []);

  // On mount: view an existing e-Requisition (read-only) or start a blank one.
  React.useEffect(() => {
    const id = readQueryParam(location.search, '_id');
    if (id) {
      const tx = readQueryParam(location.search, '_tx');
      setSelectedTransaction(tx !== null && tx !== '' ? Number(tx) : null);
      setDisabledAction(true);
      void loadRequisition(id);
      return;
    }
    setDisabledAction(false);
    setTransactions([createEmptyTransaction(1)]);
    setIsLoading(true);
    const loadOptions = async (): Promise<void> => {
      try {
        const service = getService();
        const [fiscalYears, channels, months, majorGroups, promotionTypes, categories] = await Promise.all([
          service.getFiscalYearOptions(),
          fetchChannelOptions(),
          fetchMonthOptions(),
          service.getMajorGroupOptions(),
          fetchPromotionTypeOptions(),
          fetchCategoryOptions(),
        ]);
        setFiscalYearOptions(fiscalYears);
        setChannelOptions(channels);
        setMonthOptions(months);
        setMajorGroupOptions(majorGroups);
        setPromotionOptions(promotionTypes);
        setCategoryOptions(categories);
      } catch (error) {
        console.error('Error loading form options:', error);
        setLoadError(
          'ไม่สามารถโหลดข้อมูล Channel/Fiscal Year/Promotion Month/MajorGroup Name/Promotion Type/Category ' +
            'จาก SharePoint ได้ กรุณาลองใหม่อีกครั้ง',
        );
      } finally {
        setIsLoading(false);
      }
    };
    void loadOptions();
  }, []);

  // In edit mode, keep the e-Requisition number and totals in sync with the form.
  React.useEffect(() => {
    if (disabledAction) return;
    setERequisitionNo(
      buildERequisitionNo({ channel, fiscalYear, promotionMonth, transactionCount: transactions.length }),
    );
    const totals = calculateSpendingTotals(transactions);
    setTotalSpendingTI(totals.totalSpendingTI);
    setTotalSpendingTD(totals.totalSpendingTD);
  }, [channel, fiscalYear, promotionMonth, transactions, disabledAction]);

  // When Channel + Fiscal Year + Promotion Month are all set, check whether a promotion
  // already exists for that month and, if so, load it for editing.
  React.useEffect(() => {
    if (disabledAction) return; // URL view mode: selections come from loaded data
    const tpmNo = buildTpmNo({ channel, fiscalYear, promotionMonth });
    if (!tpmNo) return; // need all three selections
    if (tpmNo === lastCheckedTpmNoRef.current) return; // already checked this combo
    lastCheckedTpmNoRef.current = tpmNo;
    void checkExistingPromotion(tpmNo);
  }, [channel, fiscalYear, promotionMonth, disabledAction]);

  const updateTransactionRow = (targetRow: ITransactionRow, field: string, value: unknown): void => {
    setTransactions((prev) =>
      prev.map((item) => {
        const rowIndex = item.tebles.findIndex(
          (row) => row === targetRow || row.Transaction === targetRow.Transaction,
        );
        if (rowIndex === -1) return item;
        const newTebles = [...item.tebles];
        newTebles[rowIndex] = { ...newTebles[rowIndex], [field]: value };
        return { ...item, tebles: newTebles };
      }),
    );
  };

  const updateMechanicsDetails = (index: number, value: string): void => {
    setTransactions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, MechanicsDetails: value } : item)),
    );
  };

  const updateExpenseRow = (
    parentIndex: number,
    expenseIndex: number,
    field: string,
    value: unknown,
  ): void => {
    setTransactions((prev) =>
      prev.map((item, i) => {
        if (i !== parentIndex) return item;
        const expenses = [...item.EstimatedPromotionExpense];
        const isExpenseType = field === 'ExpenseType';
        expenses[expenseIndex] = {
          ...expenses[expenseIndex],
          [field]: value,
          ...(isExpenseType ? { TITDType: (value as IExpenseOption | null)?.group ?? null } : {}),
        };
        return { ...item, EstimatedPromotionExpense: expenses };
      }),
    );
  };

  const updateChargeToCBURow = (
    parentIndex: number,
    cbuIndex: number,
    field: string,
    value: unknown,
  ): void => {
    setTransactions((prev) =>
      prev.map((item, i) => {
        if (i !== parentIndex) return item;
        const allocations = [...item.ChargeToCBU];
        const isMajorGroupName = field === 'MajorGroupName';
        allocations[cbuIndex] = {
          ...allocations[cbuIndex],
          [field]: value,
          ...(isMajorGroupName ? { Category: (value as IMajorGroupOption | null)?.category ?? '' } : {}),
        };
        return { ...item, ChargeToCBU: allocations };
      }),
    );
  };

  const addExpenseRow = (parentIndex: number): void => {
    setTransactions((prev) =>
      prev.map((item, i) =>
        i === parentIndex
          ? { ...item, EstimatedPromotionExpense: [...item.EstimatedPromotionExpense, createEmptyExpenseRow()] }
          : item,
      ),
    );
  };

  const removeExpenseRow = (parentIndex: number, rowIndex: number): void => {
    setTransactions((prev) =>
      prev.map((item, i) =>
        i === parentIndex
          ? {
              ...item,
              EstimatedPromotionExpense: item.EstimatedPromotionExpense.filter((_, j) => j !== rowIndex),
            }
          : item,
      ),
    );
  };

  const addChargeToCBURow = (parentIndex: number): void => {
    setTransactions((prev) =>
      prev.map((item, i) =>
        i === parentIndex
          ? { ...item, ChargeToCBU: [...item.ChargeToCBU, createEmptyChargeToCBURow()] }
          : item,
      ),
    );
  };

  const removeChargeToCBURow = (parentIndex: number, rowIndex: number): void => {
    setTransactions((prev) =>
      prev.map((item, i) =>
        i === parentIndex
          ? { ...item, ChargeToCBU: item.ChargeToCBU.filter((_, j) => j !== rowIndex) }
          : item,
      ),
    );
  };

  const updateComment = (parentIndex: number, value: string): void => {
    setTransactions((prev) =>
      prev.map((item, i) => (i === parentIndex ? { ...item, Comment: value } : item)),
    );
  };

  const setTransactionAttachment = (parentIndex: number, slotIndex: number, file: File | null): void => {
    setTransactions((prev) =>
      prev.map((item, i) => {
        if (i !== parentIndex) return item;
        const pendingAttachments = [...(item.pendingAttachments ?? [])];
        while (pendingAttachments.length <= slotIndex) pendingAttachments.push(null);
        pendingAttachments[slotIndex] = file;
        return { ...item, pendingAttachments };
      }),
    );
  };

  const addTransaction = (): void => {
    setTransactions((prev) => [...prev, createEmptyTransaction(prev.length + 1)]);
  };

  const removeTransaction = (indexToRemove: number): void => {
    setTransactions((prev) =>
      prev
        .filter((_, index) => index !== indexToRemove)
        .map((item, newIndex) => ({
          ...item,
          tebles: item.tebles.map((row) => ({ ...row, Transaction: newIndex + 1 })),
        })),
    );
  };

  const save = async (action: TFormAction): Promise<void> => {
    const validationError = validateRequisition({
      eRequisitionNo,
      channel,
      fiscalYear,
      promotionMonth,
      transactions,
    });
    if (validationError) {
      showErrorAlert(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const header: IRequisitionSaveHeader = {
        tpmNo: buildTpmNo({ channel, fiscalYear, promotionMonth }),
        promotionMonthValue: promotionMonth?.value,
        fiscalYearValue: fiscalYear?.value,
        channelValue: channel?.value ?? '',
        channelLabel: channel?.label,
        totalSpendingTI,
        totalSpendingTD,
        status: action === 'Draft' ? DRAFT_STATUS : undefined,
      };
      const service = getService();
      const lookupMaps = lookupMapsRef.current ?? (await service.loadLookupIdMaps());
      // Rows loaded from SharePoint are updated in place; only genuinely new rows are created.
      const result = await service.saveRequisition(header, transactions, lookupMaps);

      if (result.attachmentFailures.length > 0) {
        // The requisition itself is saved — only some attachments failed. Stay on this page
        // (rather than the usual navigate-away) and leave pendingAttachments in place so the
        // user can retry by saving again, without re-picking every file.
        const list = result.attachmentFailures.map((f) => `<li>${f.name}: ${f.message}</li>`).join('');
        showWarningAlert(
          `บันทึกข้อมูลสำเร็จ แต่แนบไฟล์ไม่สำเร็จ ${result.attachmentFailures.length} ไฟล์:` +
            `<ul style="text-align:left;">${list}</ul>กรุณาลองกดบันทึกอีกครั้ง`,
        );
        return;
      }

      // Every staged attachment (if any) uploaded successfully — clear them so a later Save
      // doesn't upload the same files again.
      setTransactions((prev) => prev.map((t) => ({ ...t, pendingAttachments: undefined })));
      showSuccessAlert();
      history.push('/pa');
    } catch (error) {
      console.error('Error saving requisition:', error);
      const message = error instanceof Error ? error.message : 'ไม่สามารถบันทึกข้อมูลได้';
      showErrorAlert(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Returns to the list. View mode opens in a new tab (via window.open from AllPA), so close
   * that tab to fall back to the still-open list (which keeps its filters/pagination/scroll).
   * When opened directly (no opener), navigate in-app instead.
   */
  const goBack = (): void => {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    history.push('/pa');
  };

  const handlers: IRequisitionFormHandlers = {
    updateTransactionRow,
    updateMechanicsDetails,
    updateExpenseRow,
    updateChargeToCBURow,
    addExpenseRow,
    removeExpenseRow,
    addChargeToCBURow,
    removeChargeToCBURow,
    updateComment,
    addTransaction,
    removeTransaction,
    setTransactionAttachment,
  };

  return {
    isLoading,
    disabledAction,
    selectedTransaction,
    loadError,
    notFound,
    transactions,
    channel,
    channelOptions,
    fiscalYear,
    fiscalYearOptions,
    promotionMonth,
    monthOptions,
    majorGroupOptions,
    promotionOptions,
    categoryOptions,
    eRequisitionNo,
    totalSpendingTI,
    totalSpendingTD,
    setChannel,
    setFiscalYear,
    setPromotionMonth,
    handlers,
    save,
    loadMockData,
    goBack,
  };
}
