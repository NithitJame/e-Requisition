// Shared constants for the e-Requisition web part.
// Extracted from RequestPA to remove magic strings/numbers (see docs/CONVENTIONS.md §1).

// Mock Data Seeder constants (dev-only feature).
export * from './mockData';

// Shared listing constants (moved to shared/; re-exported so existing pa imports keep working).
export { LIST_PAGE_SIZE, FISCAL_MONTH_OPTIONS } from '@/shared/constants/promotionListing';

/** SharePoint list display names queried by RequisitionService. */
export const LIST_NAMES = {
  PROMOTION_ACTIVITIES_DETAIL: 'Promotion Activities Detail',
  PROMOTION_ACTIVITIES_EXPENSES: 'Promotion Activities Expenses',
  PROMOTION_ACTIVITIES_CHARGE_TO_CBU: 'Promotion Activities Charge to CBU',
  MAJOR_GROUP_NAME: 'M_MajorGroupName',
  // Master lists used to resolve a lookup's display value back to its item id on save.
  MONTH: 'M_Month',
  CUSTOMER_SUB_GROUP: 'M_CustomerSubGroup',
  PROMOTION_TYPE: 'M_PromotionType',
  CATEGORY: 'M_Category',
  ACCOUNT_NAME: 'M_AccountName',
  // Approval workflow.
  PA_WORKFLOW_HISTORY: 'PA Workflow History',
  // Attachments for a transaction (files keyed by Ref No / TPMNo).
  PA_DOCUMENTS: 'PA Documents',
} as const;

/**
 * Promotion Activities Detail workflow fields (internal names) touched by the Approve page.
 * The approver comment + decision markers are written on submit; the routing engine
 * (ported Nintex workflow) consumes them to move the item to the next approver.
 * See CLAUDE.md §8 and docs/REQUIREMENTS.md §5. The exact marker contract should be
 * confirmed with the workflow owner if routing behaviour ever looks off.
 */
export const APPROVAL_FIELDS = {
  COMMENTS: 'Comments',
  APPROVED_TO_ALL: 'ApprovedToAll',
  REJECT_TO_ALL: 'RejectToAll',
  SALES_REP_WAIT_FLAG: 'WorkflowSalesRepWaitFlag',
  PENDING_USER_ID: 'PendingUserId',
} as const;

/** PA Workflow History (audit trail) fields written on every approve/reject action. */
export const WORKFLOW_HISTORY_FIELDS = {
  REF_NO: 'Ref_x0020_No',
  USER_ID: 'UserId',
  USER_DISPLAY_NAME: 'User_x0020_Display_x0020_Name',
  ACTION: 'Action',
  COMMENT: 'Comment',
} as const;

/** Decision action labels recorded in workflow history. */
export const APPROVAL_ACTION = { APPROVE: 'Approve', REJECT: 'Reject' } as const;

/**
 * WorkflowStatus (Title) values that mean "waiting on an approver" for the PA chain
 * KAM → SM → CM (Trade Channel Manager). A transaction is treated as pending the current
 * user when its PendingUser is the current user AND its status is one of these.
 */
export const PA_PENDING_STATUSES: string[] = ['Waiting by Kam/AM', 'Waiting by SM', 'Waiting by CM'];

/** Text written to Promotion Activities Detail `Status` when saving as a draft. */
export const DRAFT_STATUS = 'Draft';

/** M_WorkflowStatus `Title` written to Detail `WorkflowStatus` when saving as a draft. */
export const WORKFLOW_STATUS_OPEN = 'Open';

/** Request-type code embedded in the e-Requisition number (Promotion Activity). */
export const PA_TYPE_CODE = 'PA';

/** TI/TD spending classification (see docs/REQUIREMENTS.md §4.1). */
export const TITD_TYPE = { TI: 'TI', TD: 'TD' } as const;

/** Lookup ids for the ExpenseType field in the Expenses list. */
export const EXPENSE_TYPE_ID = { TD: 1, TI: 2 } as const;

