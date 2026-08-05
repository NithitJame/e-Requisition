// WorkflowStatus dropdown options, read live from the M_WorkflowStatus master list.
// That list has one boolean column per module (PA/TA/Payment/PR/Matching) marking which
// flow each status belongs to — `moduleColumn` picks which one to filter on. Preserves the
// list's own item order (not re-sorted alphabetically), since that order is the approval
// sequence (Open -> Waiting by ... -> Approved -> ...).

import { fetchMasterListOptions } from '@/shared/services/masterListOptions';
import { IOption } from '@/shared/types';

export const WORKFLOW_STATUS_MASTER_LIST_NAME = 'M_WorkflowStatus';

export type TWorkflowStatusModule = 'PA' | 'TA';

export function fetchWorkflowStatusOptions(moduleColumn: TWorkflowStatusModule): Promise<IOption[]> {
  return fetchMasterListOptions({
    listName: WORKFLOW_STATUS_MASTER_LIST_NAME,
    valueField: 'Title',
    labelField: 'Title',
    odataFilter: `${moduleColumn} eq 1`,
  });
}
