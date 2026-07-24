// PA (Promotion Activity) domain types for the e-Requisition web part.
// See docs/REQUIREMENTS.md for the business meaning of each concept.
// Generic primitives (IOption, ISharePointItem, ILookupValue) live in shared/types.

import { IOption, ISharePointItem, ILookupValue } from '@/shared/types';

export type { IOption, ISharePointItem, ILookupValue };

/**
 * An expense-type option. `group` carries the TI/TD classification used to
 * derive the row's TITDType when the option is selected.
 */
export interface IExpenseOption extends IOption {
  group?: string;
}

/**
 * Maps a 2-character channel nickname (e.g. "7E") to its full channel
 * code/name (e.g. "7-ELEVEN"). Used to build the e-Requisition number.
 */
export interface IChannelShortOption {
  value: string;
  label: string;
  code: string;
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
}

/** One estimated promotion expense line. Committed/Adjust may be raw input strings. */
export interface IExpenseRow {
  ExpenseType: IExpenseOption | null;
  TITDType: string | null;
  Committed: number | string;
  Adjust: number | string;
  Closed: boolean;
}

/** One Charge-to-CBU allocation line. Allocation may be a raw input string. */
export interface IChargeToCBURow {
  MajorGroupName: IOption | null;
  Category: string;
  Allocation: number | string;
}

/** A single promotion transaction block (one Promotion Activities Detail record). */
export interface IRequisitionTransaction {
  Title?: string;
  tebles: ITransactionRow[];
  MechanicsDetails: string;
  EstimatedPromotionExpense: IExpenseRow[];
  ChargeToCBU: IChargeToCBURow[];
  Comment: string;
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
  majorGroupOptions: IOption[];
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

/**
 * One normalised "Promotion Activities Detail" row for the AllPA listing table.
 * Lookups are flattened to `ILookupValue`; the `_x0020_`-encoded utilized totals are
 * surfaced under friendly names (`TotalSpendingTI` / `TotalSpendingTD`).
 */
export interface IPromotionActivityRow {
  Id: number;
  TPMNo: string;
  Transaction: number | string;
  Fiscal: string;
  MechanicsDetails: string;
  ExpectedToClose: string;
  Delay: string;
  PromotionWeek?: string;
  TotalSpendingTICommitted?: number;
  TotalSpendingTDCommitted?: number;
  TotalSpendingTIAdjust?: number;
  TotalSpendingTDAdjust?: number;
  TotalSpendingTI?: number;
  TotalSpendingTD?: number;
  /** W1-2 / W3-4 promotion-week flags (the `W1_x002d_2` / `W3_x002d_4` booleans). */
  W12: boolean;
  W34: boolean;
  CustomerSubGroup: ILookupValue | null;
  PromotionType: ILookupValue | null;
  PromotionMonth: ILookupValue | null;
  WorkflowStatus: ILookupValue | null;
  Category: ILookupValue[];
}

/** All filter selections held by the AllPA search screen. */
export interface IAllPaFilterState {
  channel: IOption[] | null;
  category: IOption[] | null;
  monthFrom: IOption | null;
  monthTo: IOption | null;
  fiscalYear: IOption | null;
  workflowStatus: IOption | null;
  eRequisitionNo: IOption | null;
  expectedToClose: IOption | null;
  promotionWeek: string | null;
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
}
