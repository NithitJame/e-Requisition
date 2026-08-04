// Owns the Approve page's state and orchestration: loads the current user's pending inbox,
// tracks per-row Approve/Reject/Comment decisions, validates, and submits a batch.
// The component renders UI and delegates every state change / data op here (CONVENTIONS §6).

import * as React from 'react';

import { ApprovalService } from '@/features/pa/services/ApprovalService';
import { PromotionActivityService } from '@/features/pa/services/PromotionActivityService';
import { filterPromotionActivities } from '@/features/pa/utils/promotionActivityFilter';
import { buildERequisitionNoOptions, getMonthRangeError } from '@/shared/utils/promotionListingFilter';
import { getCurrentFiscalYearValue } from '@/shared/utils/fiscalYear';
import { APPROVAL_ACTION } from '@/features/pa/constants';
import {
  IAllPaFilterState,
  IApprovalDecisionState,
  IApprovalInboxRow,
  IApprovalSubmitInput,
  ICurrentUser,
  IOption,
  TApprovalDecision,
} from '@/features/pa/types';
import { exportRowsToCsv, IExportColumn } from '@/shared/utils/exportCsv';
import { multiSelectSummary, singleSelectSummary } from '@/shared/utils/filterSummary';
import { showConfirmDialog, showErrorAlert, showSuccessAlert, showWarningAlert } from '@/shared/utils/notify';

/** SPFx context published on `window` by RequisitionWebPart.render (see useRequisitionForm). */
interface ISpfxWindow {
  _siteUrl?: string;
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

export interface IUseApprovePaInbox {
  isLoading: boolean;
  isSubmitting: boolean;
  filters: IAllPaFilterState;
  channelOptions: IOption[];
  categoryOptions: IOption[];
  fiscalYearOptions: IOption[];
  eRequisitionNoOptions: IOption[];
  rows: IApprovalInboxRow[];
  decisions: Record<number, IApprovalDecisionState>;
  submitAttempted: boolean;
  /** Set as soon as Month From/To form an invalid (reversed) fiscal range — before Search. */
  monthRangeError: string | null;
  setFilter: <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]) => void;
  /** Always pulls a fresh pending inbox before filtering (there is no separate Refresh). */
  search: () => Promise<void>;
  clear: () => void;
  setDecision: (rowId: number, decision: TApprovalDecision) => void;
  /**
   * Bulk-applies (or clears) a decision for every row currently in `rows` — the whole
   * filtered result set, not just the visible page. Toggle semantics: if every row already
   * has this decision, it clears all of them back to "no decision"; otherwise it overwrites
   * every row (including ones with the opposite decision already set) to this one.
   */
  setAllDecisions: (decision: TApprovalDecision) => void;
  setComment: (rowId: number, comment: string) => void;
  submit: () => Promise<void>;
  exportExcel: () => void;
  view: (row: IApprovalInboxRow) => void;
}

function getApprovalService(): ApprovalService {
  return new ApprovalService();
}

function getPromotionActivityService(): PromotionActivityService {
  return new PromotionActivityService();
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

/** Columns exported to CSV (business fields only; decisions are per-session, not exported). */
const EXPORT_COLUMNS: IExportColumn<IApprovalInboxRow>[] = [
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

export function useApprovePaInbox(): IUseApprovePaInbox {
  const [filters, setFilters] = React.useState<IAllPaFilterState>(EMPTY_FILTERS);
  const [channelOptions, setChannelOptions] = React.useState<IOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<IOption[]>([]);
  const [fiscalYearOptions, setFiscalYearOptions] = React.useState<IOption[]>([]);
  const [eRequisitionNoOptions, setERequisitionNoOptions] = React.useState<IOption[]>([]);
  const [rows, setRows] = React.useState<IApprovalInboxRow[]>([]);
  const [decisions, setDecisions] = React.useState<Record<number, IApprovalDecisionState>>({});
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [submitAttempted, setSubmitAttempted] = React.useState<boolean>(false);

  const currentUserRef = React.useRef<ICurrentUser | null>(null);
  // Cache of the current user's full pending inbox. Search always clears it to force a re-pull
  // (there is no separate Refresh action).
  const inboxPromiseRef = React.useRef<Promise<IApprovalInboxRow[]> | null>(null);
  // Applies the "all channels selected by default" once, when the options first load.
  const defaultChannelAppliedRef = React.useRef<boolean>(false);

  const loadInbox = React.useCallback((forceRefresh = false): Promise<IApprovalInboxRow[]> => {
    if (forceRefresh) inboxPromiseRef.current = null;
    if (!inboxPromiseRef.current) {
      const service = getApprovalService();
      inboxPromiseRef.current = service
        .getCurrentUser()
        .then((user) => {
          currentUserRef.current = user;
          return service.getPendingInbox(user.Id);
        })
        .catch((error) => {
          inboxPromiseRef.current = null; // allow a retry on the next Search
          throw error;
        });
    }
    return inboxPromiseRef.current;
  }, []);

  // On mount: load Channel/Category options and populate the pending inbox immediately (an
  // approver expects to see their queue on open; Search/Clear then refine it like AllPA).
  React.useEffect(() => {
    getPromotionActivityService()
      .getFilterOptions()
      .then(({ channels, categories, fiscalYears }) => {
        setChannelOptions(channels);
        setCategoryOptions(categories);
        setFiscalYearOptions(fiscalYears);
        if (!defaultChannelAppliedRef.current) {
          defaultChannelAppliedRef.current = true;
          const currentFiscalYear =
            fiscalYears.find((option) => option.value === getCurrentFiscalYearValue()) ?? null;
          setFilters((prev) => ({ ...prev, channel: channels, category: categories, fiscalYear: currentFiscalYear }));
        }
      })
      .catch((error) => console.error('[useApprovePaInbox] failed to load filter options.', error));

    setIsLoading(true);
    loadInbox()
      .then((data) => {
        setRows(data);
        setERequisitionNoOptions(buildERequisitionNoOptions(data));
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('[useApprovePaInbox] failed to load pending inbox.', error);
        setRows([]);
        setIsLoading(false);
      });
  }, [loadInbox]);

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

  const search = React.useCallback(async (): Promise<void> => {
    // monthRangeError is also shown inline as soon as it's wrong; this is the last-resort
    // guard so Search never runs against an invalid range.
    if (monthRangeError) {
      setRows([]);
      return;
    }

    setIsLoading(true);
    try {
      // There is no separate Refresh action, so Search always pulls a fresh pending inbox.
      const data = await loadInbox(true);
      setERequisitionNoOptions(buildERequisitionNoOptions(data));
      setRows(filterPromotionActivities(data, filters) as IApprovalInboxRow[]);
    } catch (error) {
      console.error('[useApprovePaInbox] search failed.', error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, loadInbox, monthRangeError]);

  const clear = React.useCallback((): void => {
    // Bottom "Clear" resets every filter EXCEPT Channel/Category (both default to "all
    // selected" and have no dedicated Clear of their own besides the one next to Channel).
    setFilters((prev) => ({ ...EMPTY_FILTERS, channel: prev.channel, category: prev.category }));
  }, []);

  const setDecision = React.useCallback((rowId: number, decision: TApprovalDecision): void => {
    setDecisions((prev) => ({ ...prev, [rowId]: { decision, comment: prev[rowId]?.comment ?? '' } }));
  }, []);

  const setAllDecisions = React.useCallback(
    (decision: TApprovalDecision): void => {
      setDecisions((prev) => {
        const allAlreadySet = rows.length > 0 && rows.every((row) => prev[row.Id]?.decision === decision);
        const next = { ...prev };
        for (const row of rows) {
          next[row.Id] = {
            decision: allAlreadySet ? undefined : decision,
            comment: prev[row.Id]?.comment ?? '',
          };
        }
        return next;
      });
    },
    [rows],
  );

  const setComment = React.useCallback((rowId: number, comment: string): void => {
    setDecisions((prev) => ({ ...prev, [rowId]: { decision: prev[rowId]?.decision, comment } }));
  }, []);

  const view = React.useCallback((row: IApprovalInboxRow): void => {
    window.open(buildViewUrl(row.TPMNo), '_blank');
  }, []);

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
    exportRowsToCsv('promotion-activities-approve', EXPORT_COLUMNS, rows, summaryBlock);
  }, [rows, filters, channelOptions, categoryOptions]);

  const submit = React.useCallback(async (): Promise<void> => {
    setSubmitAttempted(true);

    // Only rows with a decision selected are submitted; the rest stay untouched.
    const decided: IApprovalSubmitInput[] = [];
    for (const row of rows) {
      const state = decisions[row.Id];
      if (!state || !state.decision) continue;
      decided.push({ row, decision: state.decision, comment: (state.comment ?? '').trim() });
    }

    if (decided.length === 0) {
      showWarningAlert('กรุณาเลือก Approve หรือ Reject อย่างน้อยหนึ่งรายการก่อนยืนยัน');
      return;
    }

    // A comment is mandatory for every rejected transaction.
    const missingComment = decided.filter((d) => d.decision === APPROVAL_ACTION.REJECT && !d.comment);
    if (missingComment.length > 0) {
      const list = missingComment
        .map((d) => `<li>${d.row.TPMNo} / Transaction ${d.row.Transaction}</li>`)
        .join('');
      showWarningAlert(`กรุณาระบุ Comment สำหรับรายการที่ Reject ต่อไปนี้:<ul style="text-align:left;">${list}</ul>`);
      return;
    }

    const approveCount = decided.filter((d) => d.decision === APPROVAL_ACTION.APPROVE).length;
    const rejectCount = decided.length - approveCount;
    const confirmed = await showConfirmDialog(
      `ยืนยันการทำรายการทั้งหมด ${decided.length} รายการ (Approve ${approveCount}, Reject ${rejectCount}) หรือไม่?`,
    );
    if (!confirmed) return;

    const currentUser = currentUserRef.current;
    if (!currentUser) {
      showErrorAlert('ไม่พบข้อมูลผู้ใช้ปัจจุบัน กรุณารีเฟรชหน้าอีกครั้ง');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await getApprovalService().submitDecisions(decided, currentUser);

      if (result.submittedIds.length > 0) {
        const submitted = new Set(result.submittedIds);
        // Remove processed transactions from the pending list and drop their decisions.
        setRows((prev) => prev.filter((row) => !submitted.has(row.Id)));
        setDecisions((prev) => {
          const next = { ...prev };
          result.submittedIds.forEach((id) => delete next[id]);
          return next;
        });
        setSubmitAttempted(false);
        inboxPromiseRef.current = null; // force a fresh pull on the next Search
      }

      if (result.errors.length > 0) {
        const list = result.errors.map((e) => `<li>${e.title}: ${e.message}</li>`).join('');
        showWarningAlert(
          `ทำรายการสำเร็จ ${result.submittedIds.length} รายการ ` +
            `แต่มี ${result.errors.length} รายการที่ไม่สำเร็จ:<ul style="text-align:left;">${list}</ul>`,
        );
      } else {
        showSuccessAlert(`ทำรายการสำเร็จทั้งหมด ${result.submittedIds.length} รายการ`);
      }
    } catch (error) {
      console.error('[useApprovePaInbox] submit failed.', error);
      showErrorAlert('ไม่สามารถส่งผลการอนุมัติได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  }, [rows, decisions]);

  return {
    isLoading,
    isSubmitting,
    filters,
    channelOptions,
    categoryOptions,
    fiscalYearOptions,
    eRequisitionNoOptions,
    rows,
    decisions,
    submitAttempted,
    monthRangeError,
    setFilter,
    search,
    clear,
    setDecision,
    setAllDecisions,
    setComment,
    submit,
    exportExcel,
    view,
  };
}
