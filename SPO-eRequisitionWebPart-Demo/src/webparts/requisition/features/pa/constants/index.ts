// Shared constants for the e-Requisition web part.
// Extracted from RequestPA to remove magic strings/numbers (see docs/CONVENTIONS.md §1).

import { IChannelShortOption } from '@/features/pa/types';

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

/** Request-type code embedded in the e-Requisition number (Promotion Activity). */
export const PA_TYPE_CODE = 'PA';

/** TI/TD spending classification (see docs/REQUIREMENTS.md §4.1). */
export const TITD_TYPE = { TI: 'TI', TD: 'TD' } as const;

/** Lookup ids for the ExpenseType field in the Expenses list. */
export const EXPENSE_TYPE_ID = { TD: 1, TI: 2 } as const;

/** Channel nickname -> full channel code map, used to build the e-Requisition number. */
export const CHANNEL_SHORT_OPTIONS: IChannelShortOption[] = [
  { value: '7E', label: '7E', code: '7-ELEVEN' },
  { value: 'AD', label: 'AD', code: 'ALL D' },
  { value: 'BC', label: 'BC', code: 'BIG C' },
  { value: 'BK', label: 'BK', code: 'BKK COOP' },
  { value: 'BT', label: 'BT', code: 'BOOTS' },
  { value: 'GO', label: 'GO', code: 'CFW' },
  { value: 'CJ', label: 'CJ', code: 'CJ' },
  { value: 'CP', label: 'CP', code: 'CPF' },
  { value: 'CVD', label: 'CVD', code: 'CV BLITZ' },
  { value: 'DA', label: 'DA', code: 'DA' },
  { value: 'DN2', label: 'DN2', code: 'DIST_NOE2' },
  { value: 'DN1', label: 'DN1', code: 'DIST_NOR1' },
  { value: 'DN3', label: 'DN3', code: 'DIST_NOR3' },
  { value: 'EC', label: 'EC', code: 'E-COMMERCE' },
  { value: 'FL', label: 'FL', code: 'FOODLAND' },
  { value: 'FS', label: 'FS', code: 'FS' },
  { value: 'ISN', label: 'ISN', code: 'ISETAN' },
  { value: 'JFY', label: 'JFY', code: 'JIFFY' },
  { value: 'JUS', label: 'JUS', code: 'JUSCO' },
  { value: 'MK', label: 'MK', code: 'MAKRO' },
  { value: 'MMK', label: 'MMK', code: 'MEGA MARKET' },
  { value: 'OT', label: 'OT', code: 'OTHER CVS' },
  { value: 'OHY', label: 'OHY', code: 'OTHER HYPER' },
  { value: 'SFM', label: 'SFM', code: 'SFM' },
  { value: 'SSV', label: 'SSV', code: 'SUPERSAVE' },
  { value: 'SWR', label: 'SWR', code: 'SUWANNACHARD' },
  { value: 'TGS', label: 'TGS', code: 'TANGHUASENG' },
  { value: 'TES', label: 'TES', code: 'TESCO' },
  { value: 'TM', label: 'TM', code: 'THEMALL' },
  { value: 'TOK', label: 'TOK', code: 'TOKYO' },
  { value: 'TD', label: 'TD', code: 'TOOK DEE' },
  { value: 'TOPS', label: 'TOPS', code: 'TOPS' },
  { value: 'UFM', label: 'UFM', code: 'UFM FUJI' },
  { value: 'VLA', label: 'VLA', code: 'VILLA' },
  { value: 'WAT', label: 'WAT', code: 'WATSON' },
];

