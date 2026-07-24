import { IDropdownOption } from '@fluentui/react';

// Constants for the developer-only Mock Data Seeder (TASK_mock_data_seeder.md).
//
// TWO-PHASE architecture: Phase 1 fetched the template e-Requisition (TPMNo prefix
// below) ONCE, offline, via a dev script and bundled it as
// src/webparts/requisition/mockData/mockTemplate.json. Phase 2 (Option A) maps that
// bundle into the live RequestPA form state — it does NOT read or write SharePoint.
// The form's existing Submit is the only POST (the path being load-tested).

/**
 * TPMNo prefix of the known-good template the seeder fills the form from.
 */
export const MOCK_TEMPLATE_SOURCE_PREFIX = 'DAPA1920-01';

/**
 * Fiscal calendar for the Fiscal Month dropdown.
 * The fiscal year starts in September, so September = "01" (docs/REQUIREMENTS.md §3, BR-02).
 */
export const FISCAL_MONTHS: IDropdownOption[] = [
  { key: '01', text: '01 — September' },
  { key: '02', text: '02 — October' },
  { key: '03', text: '03 — November' },
  { key: '04', text: '04 — December' },
  { key: '05', text: '05 — January' },
  { key: '06', text: '06 — February' },
  { key: '07', text: '07 — March' },
  { key: '08', text: '08 — April' },
  { key: '09', text: '09 — May' },
  { key: '10', text: '10 — June' },
  { key: '11', text: '11 — July' },
  { key: '12', text: '12 — August' },
];

/**
 * M_ExpenseType item id -> Description, verified read-only against SharePoint Online
 * (SharePoint_Scripts/fetchExpenseTypeMap.py -> data/lookupMaps.json).
 *
 * The bundle stores ExpenseType as an integer id, but mapRawDataToForm needs the TI/TD
 * text so the form's Submit can re-derive the correct ExpenseTypeId. Ids 4/5/6 mirror
 * 1/2/3 in the live list; the bundle's Expenses rows use 4 (TD) and 5 (TI).
 */
export const EXPENSE_TYPE_DESCRIPTION_BY_ID: Record<number, string> = {
  1: 'TD',
  2: 'TI',
  3: 'TI/TD',
  4: 'TD',
  5: 'TI',
  6: 'TI/TD',
};
