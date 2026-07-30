// Generic, domain-agnostic types shared across all features.
// Feature-specific domain types live in that feature's types.ts. The promotion-listing
// row/filter types live here because they are shared by multiple features (PA, TA, Approve).

/** A generic select option (value + display label). */
export interface IOption {
  value: string | number;
  label: string;
}

/** A raw SharePoint list item. Field values are dynamic, hence `unknown`. */
export interface ISharePointItem {
  [fieldName: string]: unknown;
}

/** A SharePoint lookup value normalised to the `{ LookupValue }` shape the tables expect. */
export interface ILookupValue {
  LookupValue: string;
}

/**
 * One normalised Detail row for a promotion/trade-agreement listing table (AllPA / AllTA).
 * PA and TA Detail lists share this shape; TA has no `…Adjust` fields, so those come back
 * undefined and render as "-".
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

/** All filter selections held by a promotion/trade-agreement listing search screen. */
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
