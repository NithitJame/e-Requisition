// SharePoint REST access for the Approve page (Promotion Activities > Approve).
// Components/hooks never call axios directly (docs/CONVENTIONS.md §6); they go
// through this service.
//
// Routing is owned by the existing (ported Nintex) workflow engine — this service only
// RECORDS the approver's decision: it writes the approver Comment + decision markers on the
// transaction and appends a PA Workflow History row. The engine then moves the item to the
// next approver / back to the requester. See CLAUDE.md §8 and constants/APPROVAL_FIELDS.

import axios from 'axios';

import {
  APPROVAL_ACTION,
  APPROVAL_FIELDS,
  LIST_NAMES,
  LIST_PAGE_SIZE,
  PA_PENDING_STATUSES,
  WORKFLOW_HISTORY_FIELDS,
} from '@/features/pa/constants';
import { comparePromotionActivities } from '@/features/pa/utils/promotionActivityFilter';
import {
  IRawPadItem,
  PAD_BASE_SELECT,
  PAD_EXPAND,
  PAD_LOOKUP_SELECT,
  mapRawPadToRow,
} from '@/features/pa/utils/promotionActivityMapper';
import {
  IApprovalInboxRow,
  IApprovalSubmitInput,
  IApprovalSubmitResult,
  ICurrentUser,
} from '@/features/pa/types';
import { fetchAllListItems } from '@/shared/utils/spItems';
import api, { getSiteUrl } from '@/shared/services/api';

const PAD_LIST = LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL;
const HISTORY_LIST = LIST_NAMES.PA_WORKFLOW_HISTORY;

const VERBOSE_HEADERS = {
  Accept: 'application/json;odata=verbose',
  'Content-Type': 'application/json;odata=verbose',
};

export class ApprovalService {
  private entityTypeCache: Record<string, string> = {};

  /** The logged-in SharePoint user. */
  public async getCurrentUser(): Promise<ICurrentUser> {
    try {
      const response = await api.get(`${getSiteUrl()}/_api/web/currentuser?$select=Id,Title,Email,LoginName`);
      const user = response.data;
      return {
        Id: user.Id,
        Title: user.Title ?? '',
        Email: user.Email ?? '',
        LoginName: user.LoginName ?? '',
      };
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      throw new Error(`Failed to load current user (HTTP ${status ?? 'unknown'}).`);
    }
  }

  /**
   * Loads the transactions currently pending the given user's approval.
   *
   * `PendingUser`/`WorkflowStatus` are NOT indexed on the ~9,900-row Detail list, so a
   * server-side `$filter` throws a list-view-threshold error. We therefore page the whole
   * list once (same pattern as AllPA) and filter in memory: PendingUser == current user AND
   * status is one of the KAM → SM → CM "Waiting by …" states.
   */
  public async getPendingInbox(currentUserId: number): Promise<IApprovalInboxRow[]> {
    const select = [...PAD_BASE_SELECT, 'Title', APPROVAL_FIELDS.PENDING_USER_ID, ...PAD_LOOKUP_SELECT].join(
      ',',
    );
    const query = `$select=${select}&$expand=${PAD_EXPAND}&$top=${LIST_PAGE_SIZE}`;

    const rawItems = await fetchAllListItems(PAD_LIST, query);

    const rows = rawItems
      .map((raw): IApprovalInboxRow => {
        const item = raw as unknown as IRawPadItem;
        return {
          ...mapRawPadToRow(item),
          Title: item.Title ?? '',
          PendingUserId: item.PendingUserId,
        };
      })
      .filter(
        (row) =>
          row.PendingUserId === currentUserId &&
          PA_PENDING_STATUSES.indexOf(row.WorkflowStatus?.LookupValue ?? '') !== -1,
      );

    return rows.sort(comparePromotionActivities);
  }

  /**
   * Submits a batch of decisions. For each transaction: re-verifies it is still pending the
   * current user, records the decision (Comment + markers) on the transaction, and appends a
   * PA Workflow History row. Per-item failures are collected, not thrown, so one bad row does
   * not abort the batch.
   *
   * NOTE: this best-effort re-check is a convenience, NOT a security boundary — the backend
   * must independently verify each item is still pending the user (CLAUDE.md / spec §9).
   */
  public async submitDecisions(
    inputs: IApprovalSubmitInput[],
    currentUser: ICurrentUser,
  ): Promise<IApprovalSubmitResult> {
    const result: IApprovalSubmitResult = { submittedIds: [], errors: [] };

    for (const input of inputs) {
      const { row, decision, comment } = input;
      try {
        const stillPending = await this.isStillPending(row.Id, currentUser.Id);
        if (!stillPending) {
          result.errors.push({
            id: row.Id,
            title: row.Title,
            message: 'ไม่สามารถทำรายการได้: รายการนี้ไม่ได้รออนุมัติโดยคุณแล้ว',
          });
          continue;
        }

        await this.recordDecisionOnTransaction(row.Id, decision, comment);
        await this.appendWorkflowHistory(row.Title, decision, comment, currentUser);
        result.submittedIds.push(row.Id);
      } catch (error) {
        result.errors.push({
          id: row.Id,
          title: row.Title,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /** Re-reads the transaction and returns true when it is still pending `currentUserId`. */
  private async isStillPending(itemId: number, currentUserId: number): Promise<boolean> {
    try {
      const response = await api.get(
        `${getSiteUrl()}/_api/web/lists/GetByTitle('${PAD_LIST}')/items(${itemId})?$select=${APPROVAL_FIELDS.PENDING_USER_ID}`,
      );
      return response.data[APPROVAL_FIELDS.PENDING_USER_ID] === currentUserId;
    } catch {
      return false;
    }
  }

  /** MERGE the approver Comment + decision markers onto the transaction. */
  private async recordDecisionOnTransaction(
    itemId: number,
    decision: IApprovalSubmitInput['decision'],
    comment: string,
  ): Promise<void> {
    const entityType = await this.getListItemEntityType(PAD_LIST);
    const isApprove = decision === APPROVAL_ACTION.APPROVE;

    const body: Record<string, unknown> = {
      __metadata: { type: entityType },
      [APPROVAL_FIELDS.COMMENTS]: comment,
      [APPROVAL_FIELDS.APPROVED_TO_ALL]: isApprove,
      [APPROVAL_FIELDS.REJECT_TO_ALL]: !isApprove,
    };
    // A rejection returns the transaction to the requester for correction.
    if (!isApprove) body[APPROVAL_FIELDS.SALES_REP_WAIT_FLAG] = true;

    await this.mergeItem(`${getSiteUrl()}/_api/web/lists/GetByTitle('${PAD_LIST}')/items(${itemId})`, body);
  }

  /** Append one audit-trail row to PA Workflow History. */
  private async appendWorkflowHistory(
    refNo: string,
    decision: IApprovalSubmitInput['decision'],
    comment: string,
    currentUser: ICurrentUser,
  ): Promise<void> {
    const entityType = await this.getListItemEntityType(HISTORY_LIST);
    const body: Record<string, unknown> = {
      __metadata: { type: entityType },
      [WORKFLOW_HISTORY_FIELDS.REF_NO]: refNo,
      [WORKFLOW_HISTORY_FIELDS.USER_ID]: currentUser.Id,
      [WORKFLOW_HISTORY_FIELDS.USER_DISPLAY_NAME]: currentUser.Title,
      [WORKFLOW_HISTORY_FIELDS.ACTION]: decision,
      [WORKFLOW_HISTORY_FIELDS.COMMENT]: comment,
    };
    await this.createItem(`${getSiteUrl()}/_api/web/lists/GetByTitle('${HISTORY_LIST}')/items`, body);
  }

  /** Resolves and caches a list's `ListItemEntityTypeFullName` (needed for create/merge). */
  private async getListItemEntityType(listName: string): Promise<string> {
    if (this.entityTypeCache[listName]) return this.entityTypeCache[listName];
    try {
      const response = await api.get(
        `${getSiteUrl()}/_api/web/lists/GetByTitle('${listName}')?$select=ListItemEntityTypeFullName`,
      );
      const entityType = response.data.ListItemEntityTypeFullName as string;
      this.entityTypeCache[listName] = entityType;
      return entityType;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      throw new Error(`Failed to resolve entity type for '${listName}' (HTTP ${status ?? 'unknown'}).`);
    }
  }

  private async createItem(url: string, body: Record<string, unknown>): Promise<void> {
    try {
      await api.post(url, body, { headers: VERBOSE_HEADERS });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      throw new Error(`Create failed (HTTP ${status ?? 'unknown'}).`);
    }
  }

  private async mergeItem(url: string, body: Record<string, unknown>): Promise<void> {
    try {
      await api.post(url, body, {
        headers: { ...VERBOSE_HEADERS, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      throw new Error(`Update failed (HTTP ${status ?? 'unknown'}).`);
    }
  }
}
