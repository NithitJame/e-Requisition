// PA (Promotion Activity) domain types for the e-Requisition web part.
// See docs/REQUIREMENTS.md for the business meaning of each concept.
// Generic primitives (IOption, ISharePointItem, ILookupValue) live in shared/types.

import { IOption, ISharePointItem, IPromotionActivityRow } from '@/shared/types';

// Re-export the shared primitives + listing types so existing `@/features/pa/types` imports
// keep working now that the promotion-listing row/filter types live in shared/types.
// (IPromotionActivityRow is also imported above because IApprovalInboxRow extends it.)
export type { IOption, ISharePointItem, ILookupValue, IPromotionActivityRow, IAllPaFilterState } from '@/shared/types';

/**
 * An expense-type option. `group` carries the TI/TD classification used to
 * derive the row's TITDType when the option is selected.
 */
export interface IExpenseOption extends IOption {
  group?: string;
}

/**
 * A MajorGroup Name option for the Charge-to-CBU table. `category` is the M_MajorGroupName
 * "SubBrand:Category" value, applied to the row's read-only Category cell when this option
 * is selected.
 */
export interface IMajorGroupOption extends IOption {
  category: string;
}

/** Action triggered by the form footer buttons. */
export type TFormAction = 'Draft' | 'Submit';

/** One row in the per-transaction summary table (the `tebles` array). */
export interface ITransactionRow {
  Transaction: number | string;
  PromotionType: IOption | null;
  Category: IOption | null;
  W12: boolean;
  W34: boolean;
  Attachment: string | null;
  Amount: number;
  Status: string | null;
  Closed: boolean;
  /** Charge-to-CBU "% Allocation" checkbox for this transaction (Detail.Allocation). */
  Allocation: boolean;
}

/** One estimated promotion expense line. Committed/Adjust may be raw input strings. */
export interface IExpenseRow {
  /** SharePoint item id when this row was loaded from the list; absent for rows added in the
   * form (save updates the former in place and creates the latter). */
  Id?: number;
  ExpenseType: IExpenseOption | null;
  TITDType: string | null;
  Committed: number | string;
  Adjust: number | string;
  Closed: boolean;
}

/** One Charge-to-CBU allocation line. Allocation may be a raw input string. */
export interface IChargeToCBURow {
  /** SharePoint item id when loaded from the list; absent for rows added in the form. */
  Id?: number;
  MajorGroupName: IOption | null;
  Category: string;
  Allocation: number | string;
}

/** A single promotion transaction block (one Promotion Activities Detail record). */
export interface IRequisitionTransaction {
  /** Detail item id when loaded from the list; absent for transactions added in the form. */
  Id?: number;
  /**
   * The stored Ref No (Detail `Title`, e.g. "DAPA2526-12-1"). Never re-derived from the form's
   * displayed transaction number on save — attachments and workflow history are keyed by this
   * value, so it stays fixed for the life of the item even if rows above it are deleted.
   */
  Title?: string;
  tebles: ITransactionRow[];
  MechanicsDetails: string;
  EstimatedPromotionExpense: IExpenseRow[];
  ChargeToCBU: IChargeToCBURow[];
  Comment: string;
  /**
   * M_WorkflowStatus `Title` for this transaction (e.g. "Open", "Waiting by SM"). Only read in
   * view mode, to decide whether the View page's limited inline edit is available — see
   * RequestPA/TransactionSection.tsx.
   */
  workflowStatus?: string | null;
  /**
   * Files picked in the Attachment modal but not uploaded yet — one entry per modal slot, `null`
   * for an empty slot. Kept on the transaction itself (not keyed by Ref No) so add/remove/reorder
   * in the form can't mis-associate them; saveRequisition uploads them once the item's real Ref
   * No is known (assigned once, at creation — see IRequisitionTransaction.Title).
   */
  pendingAttachments?: Array<File | null>;
}

/** Raw, untransformed SharePoint data for one e-Requisition. */
export interface IRequisitionRawData {
  padRows: ISharePointItem[];
  expenseRows: ISharePointItem[];
  cbuRows: ISharePointItem[];
  majorGroupCategoryMap: Record<string, string>;
}

/** Option lists required to map raw SharePoint data back into form values. */
export interface IRequisitionOptionSet {
  channelOptions: IOption[];
  fiscalYearOptions: IOption[];
  monthOptions: IOption[];
  promotionOptions: IOption[];
  categoryOptions: IOption[];
  expenseOptions: IExpenseOption[];
  majorGroupOptions: IMajorGroupOption[];
}

/**
 * Parsed segments of an e-Requisition number `[Channel][Type][FY]-[MM]-[TxNo]`
 * (e.g. "DAPA2526-03-1"). `txNo` is "" when the number has no trailing TxNo
 * segment (some TPMNo values stop at the month, e.g. "DAPA2526-03").
 * Used by the Mock Data Seeder; see utils/requisitionNumberUtils.ts.
 */
export interface IReqNumberParts {
  channel: string;
  type: string; // "PA" | "TA"
  fy: string; // 4-digit string
  month: string; // 2-digit zero-padded string
  txNo: string;
}

/**
 * Form values entered in the Mock Data Seeder dialog.
 * Canonical definition lives here (not in the component) so utils/validation can
 * depend on it without importing the MockDataSeeder component. The component's
 * MockDataSeeder.types.ts re-exports this type.
 */
export interface IMockDataSeederFormValues {
  fiscalYear: string; // 4-digit string e.g. "2526"
  fiscalMonth: string; // zero-padded 2-digit string e.g. "03"
}

// IPromotionActivityRow and IAllPaFilterState now live in shared/types (re-exported above),
// since AllPA, AllTA, and Approve all depend on them.

/** One row of a transaction's workflow history (PA Workflow History audit trail). */
export interface IWorkflowHistoryEntry {
  user: string;
  action: string;
  comment: string;
  date: string;
}

/** One attachment/document belonging to a transaction (name + download URL). */
export interface IAttachmentFile {
  name: string;
  url: string;
}

/** An approval decision for a single transaction on the Approve page. */
export type TApprovalDecision = 'Approve' | 'Reject';

/** The logged-in SharePoint user, as returned by `/_api/web/currentuser`. */
export interface ICurrentUser {
  Id: number;
  Title: string;
  Email: string;
  LoginName: string;
}

/**
 * One row in the Approve page's pending inbox: the AllPA listing row plus the fields the
 * approval flow needs — `Title` (Ref No, unique per transaction; joins to workflow history)
 * and `PendingUserId` (the SharePoint user id the transaction is currently waiting on).
 */
export interface IApprovalInboxRow extends IPromotionActivityRow {
  Title: string;
  PendingUserId?: number;
}

/** The approver's in-progress decision for one inbox row (before submit). */
export interface IApprovalDecisionState {
  decision?: TApprovalDecision;
  comment: string;
}

/** A validated decision ready to submit for one transaction. */
export interface IApprovalSubmitInput {
  row: IApprovalInboxRow;
  decision: TApprovalDecision;
  comment: string;
}

/** Outcome of a batch submit: which item ids succeeded, and any per-item failures. */
export interface IApprovalSubmitResult {
  submittedIds: number[];
  errors: Array<{ id: number; title: string; message: string }>;
}

/** Callbacks the form passes down to header rows, tables, and column cells. */
export interface IRequisitionFormHandlers {
  updateTransactionRow: (row: ITransactionRow, field: string, value: unknown) => void;
  updateMechanicsDetails: (index: number, value: string) => void;
  updateExpenseRow: (parentIndex: number, expenseIndex: number, field: string, value: unknown) => void;
  updateChargeToCBURow: (parentIndex: number, cbuIndex: number, field: string, value: unknown) => void;
  addExpenseRow: (parentIndex: number) => void;
  removeExpenseRow: (parentIndex: number, rowIndex: number) => void;
  addChargeToCBURow: (parentIndex: number) => void;
  removeChargeToCBURow: (parentIndex: number, rowIndex: number) => void;
  updateComment: (parentIndex: number, value: string) => void;
  addTransaction: () => void;
  removeTransaction: (index: number) => void;
  /** Stages (or clears, with `null`) one Attachment-modal slot for a transaction. */
  setTransactionAttachment: (parentIndex: number, slotIndex: number, file: File | null) => void;
}
