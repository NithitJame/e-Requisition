// Owns the Approve page's state and orchestration: loads the current user's pending inbox,
// tracks per-row Approve/Reject/Comment decisions, validates, and submits a batch.
// The component renders UI and delegates every state change / data op here (CONVENTIONS §6).

import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';

import { ApprovalService } from '@/features/pa/services/ApprovalService';
import { PromotionActivityService } from '@/features/pa/services/PromotionActivityService';
import { filterPromotionActivities } from '@/features/pa/utils/promotionActivityFilter';
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
import { showConfirmDialog, showErrorAlert, showSuccessAlert, showWarningAlert } from '@/shared/utils/notify';

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

export interface IUseApprovePaInbox {
  isLoading: boolean;
  isSubmitting: boolean;
  filters: IAllPaFilterState;
  channelOptions: IOption[];
  categoryOptions: IOption[];
  rows: IApprovalInboxRow[];
  decisions: Record<number, IApprovalDecisionState>;
  submitAttempted: boolean;
  setFilter: <K extends keyof IAllPaFilterState>(key: K, value: IAllPaFilterState[K]) => void;
  search: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
  setDecision: (rowId: number, decision: TApprovalDecision) => void;
  setComment: (rowId: number, comment: string) => void;
  submit: () => Promise<void>;
  exportExcel: () => void;
  view: (row: IApprovalInboxRow) => void;
}

function getSpfxContext(): { spHttpClient: SPHttpClient; siteUrl: string } {
  const spfxWindow = window as unknown as ISpfxWindow;
  const { __spfxSpHttpClient: spHttpClient, _siteUrl: siteUrl } = spfxWindow;
  if (!spHttpClient || !siteUrl) {
    throw new Error('SPFx context is not available on window.');
  }
  return { spHttpClient, siteUrl };
}

function getApprovalService(): ApprovalService {
  const { spHttpClient, siteUrl } = getSpfxContext();
  return new ApprovalService(spHttpClient, siteUrl);
}

function getPromotionActivityService(): PromotionActivityService {
  const { spHttpClient, siteUrl } = getSpfxContext();
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

/** Columns exported to CSV (business fields only; decisions are per-session, not exported). */
const EXPORT_COLUMNS: IExportColumn<IApprovalInboxRow>[] = [
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

export function useApprovePaInbox(): IUseApprovePaInbox {
  const [filters, setFilters] = React.useState<IAllPaFilterState>(EMPTY_FILTERS);
  const [channelOptions, setChannelOptions] = React.useState<IOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<IOption[]>([]);
  const [rows, setRows] = React.useState<IApprovalInboxRow[]>([]);
  const [decisions, setDecisions] = React.useState<Record<number, IApprovalDecisionState>>({});
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [submitAttempted, setSubmitAttempted] = React.useState<boolean>(false);

  const currentUserRef = React.useRef<ICurrentUser | null>(null);
  // Cache of the current user's full pending inbox. `refresh()` clears it to force a re-pull.
  const inboxPromiseRef = React.useRef<Promise<IApprovalInboxRow[]> | null>(null);

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
      .then(({ channels, categories }) => {
        setChannelOptions(channels);
        setCategoryOptions(categories);
      })
      .catch((error) => console.error('[useApprovePaInbox] failed to load filter options.', error));

    setIsLoading(true);
    loadInbox()
      .then((data) => {
        setRows(data);
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

  const runSearch = React.useCallback(
    async (forceRefresh: boolean): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await loadInbox(forceRefresh);
        setRows(filterPromotionActivities(data, filters) as IApprovalInboxRow[]);
      } catch (error) {
        console.error('[useApprovePaInbox] search failed.', error);
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, loadInbox],
  );

  const search = React.useCallback(() => runSearch(false), [runSearch]);
  const refresh = React.useCallback(() => runSearch(true), [runSearch]);

  const clear = React.useCallback((): void => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const setDecision = React.useCallback((rowId: number, decision: TApprovalDecision): void => {
    setDecisions((prev) => ({ ...prev, [rowId]: { decision, comment: prev[rowId]?.comment ?? '' } }));
  }, []);

  const setComment = React.useCallback((rowId: number, comment: string): void => {
    setDecisions((prev) => ({ ...prev, [rowId]: { decision: prev[rowId]?.decision, comment } }));
  }, []);

  const view = React.useCallback((row: IApprovalInboxRow): void => {
    window.open(buildViewUrl(row.TPMNo), '_blank');
  }, []);

  const exportExcel = React.useCallback((): void => {
    exportRowsToCsv('promotion-activities-approve', EXPORT_COLUMNS, rows);
  }, [rows]);

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
        inboxPromiseRef.current = null; // force a fresh pull on the next Search/Refresh
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
    rows,
    decisions,
    submitAttempted,
    setFilter,
    search,
    refresh,
    clear,
    setDecision,
    setComment,
    submit,
    exportExcel,
    view,
  };
}
