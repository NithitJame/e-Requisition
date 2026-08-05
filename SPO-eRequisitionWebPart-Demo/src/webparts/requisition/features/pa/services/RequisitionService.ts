// All SharePoint REST access for the e-Requisition web part lives here.
// Components/hooks never call axios directly (see docs/CONVENTIONS.md §6).

import axios from 'axios';

import {
  EXPENSE_TYPE_ID,
  LIST_NAMES,
  LIST_PAGE_SIZE,
  TITD_TYPE,
  WORKFLOW_HISTORY_FIELDS,
} from '@/features/pa/constants';
import { sumCommittedByType } from '@/features/pa/utils/totals';
import { fetchFiscalYearOptions } from '@/shared/services/FiscalYearService';
import api, { getSiteUrl } from '@/shared/services/api';
import {
  IAttachmentFile,
  IChargeToCBURow,
  IExpenseRow,
  IOption,
  IRequisitionRawData,
  IRequisitionTransaction,
  ISharePointItem,
  IWorkflowHistoryEntry,
} from '@/features/pa/types';

/** Header-level values shared by every transaction when saving an e-Requisition. */
export interface IRequisitionSaveHeader {
  /** e-Requisition prefix shared by all transactions, e.g. "DAPA2526-12" (the TPMNo). */
  tpmNo: string;
  promotionMonthValue?: string | number;
  fiscalYearValue?: string | number;
  channelValue: string | number;
  totalSpendingTI: number;
  totalSpendingTD: number;
  /** Free-text status written to the Detail item (e.g. "Draft"); omitted for Submit. */
  status?: string;
}

/**
 * Display-value -> item-id maps for every lookup column the form writes. Built from the
 * master lists by loadLookupIdMaps(); SharePoint lookup columns must be set by id
 * (`<InternalName>Id`), but the form only holds the display text.
 */
export interface ILookupIdMaps {
  customerSubGroup: Record<string, number>;
  promotionMonth: Record<string, number>;
  promotionType: Record<string, number>;
  category: Record<string, number>;
  accountName: Record<string, number>;
  majorGroupName: Record<string, number>;
}

interface IPagedResult {
  ok: boolean;
  items: ISharePointItem[];
}

// `Id` is selected on every list so an edited requisition can be saved by updating the items it
// was loaded from (see saveRequisition) instead of replacing the whole set.
const SELECT_EXPAND = {
  PAD:
    '$select=Id,Title,TPMNo,Transaction,Fiscal,MechanicsDetails,Comments,Amount,Status,' +
    'W1_x002d_2,W3_x002d_4,TotalSpendingTICommitted,TotalSpendingTDCommitted,' +
    'CustomerSubGroup/Description,PromotionMonth/Description,PromotionType/Description,Category/Description' +
    '&$expand=CustomerSubGroup,PromotionMonth,PromotionType,Category',
  EXPENSES:
    '$select=Id,Title,TPMNo,Committed,Adjust,ClosedExpense,' +
    'Account_x0020_Name/Description,ExpenseType/Description&$expand=Account_x0020_Name,ExpenseType',
  CBU: '$select=Id,Title,TPMNo,Allocation,MajorGroupName/Description&$expand=MajorGroupName',
};

export class RequisitionService {
  /** Fetches every item across pages; ok=false if any request fails (e.g. list view threshold). */
  private async fetchAllPaged(url: string): Promise<IPagedResult> {
    let items: ISharePointItem[] = [];
    let nextUrl: string | undefined = url;

    while (nextUrl) {
      let data: { value?: ISharePointItem[]; '@odata.nextLink'?: string; 'odata.nextLink'?: string };
      try {
        const response = await api.get(nextUrl);
        data = response.data;
      } catch {
        return { ok: false, items: [] };
      }
      if (data.value) items = [...items, ...data.value];
      nextUrl = data['@odata.nextLink'] ?? data['odata.nextLink'];
    }

    return { ok: true, items };
  }

  /**
   * Fetches items for a TPM number: tries a server-side $filter first (fast when the
   * column is indexed), then falls back to fetch-all + client filter for large lists.
   */
  private async getItemsByTPMNo(
    listName: string,
    tpmNo: string,
    selectExpand: string,
  ): Promise<ISharePointItem[]> {
    const base = `${getSiteUrl()}/_api/web/lists/GetByTitle('${listName}')/items`;
    const filtered = await this.fetchAllPaged(
      `${base}?$filter=TPMNo eq '${tpmNo}'&${selectExpand}&$top=${LIST_PAGE_SIZE}`,
    );
    if (filtered.ok) return filtered.items;

    const all = await this.fetchAllPaged(`${base}?${selectExpand}&$top=${LIST_PAGE_SIZE}`);
    return all.items.filter((row) => row.TPMNo === tpmNo);
  }

  /** Builds a map of MajorGroupName (Description) -> Category from M_MajorGroupName. */
  private async loadMajorGroupCategoryMap(): Promise<Record<string, string>> {
    const base = `${getSiteUrl()}/_api/web/lists/GetByTitle('${LIST_NAMES.MAJOR_GROUP_NAME}')/items`;

    const readCategory = (item: ISharePointItem): string => {
      let raw: unknown = item.SubBrand_x003a_Category;
      const isEmpty = (v: unknown): boolean => v === null || v === undefined;
      if (isEmpty(raw) && item.SubBrand) raw = (item.SubBrand as { Category?: unknown }).Category;
      if (isEmpty(raw)) return '';
      if (typeof raw === 'object') {
        const obj = raw as { LookupValue?: string; Category?: string };
        return obj.LookupValue ?? obj.Category ?? '';
      }
      return String(raw);
    };

    // Projected lookup columns are inconsistent in REST, so try several shapes.
    const candidates = [
      `${base}?$select=Description,SubBrand_x003a_Category&$top=${LIST_PAGE_SIZE}`,
      `${base}?$select=Description,SubBrand/Category&$expand=SubBrand&$top=${LIST_PAGE_SIZE}`,
      `${base}?$top=${LIST_PAGE_SIZE}`,
    ];

    let items: ISharePointItem[] = [];
    for (const url of candidates) {
      const result = await this.fetchAllPaged(url);
      if (!result.ok || result.items.length === 0) continue;
      if (!items.length) items = result.items; // keep as a fallback
      if (result.items.some((item) => readCategory(item))) {
        items = result.items; // found a shape that yields real categories
        break;
      }
    }

    const map: Record<string, string> = {};
    for (const item of items) {
      if (item.Description) map[String(item.Description)] = readCategory(item);
    }
    return map;
  }

  /** Loads all raw SharePoint data for a single e-Requisition. */
  public async getRequisitionRawData(tpmNo: string): Promise<IRequisitionRawData> {
    const padRows = await this.getItemsByTPMNo(
      LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL,
      tpmNo,
      SELECT_EXPAND.PAD,
    );
    const expenseRows = await this.getItemsByTPMNo(
      LIST_NAMES.PROMOTION_ACTIVITIES_EXPENSES,
      tpmNo,
      SELECT_EXPAND.EXPENSES,
    );
    const cbuRows = await this.getItemsByTPMNo(
      LIST_NAMES.PROMOTION_ACTIVITIES_CHARGE_TO_CBU,
      tpmNo,
      SELECT_EXPAND.CBU,
    );
    const majorGroupCategoryMap = await this.loadMajorGroupCategoryMap();

    return { padRows, expenseRows, cbuRows, majorGroupCategoryMap };
  }

  /**
   * Reads the workflow-history audit trail for one transaction (by its Ref No / Title).
   * Tries a server-side $filter first, then falls back to fetch-all + client filter
   * (Ref_x0020_No is not indexed). Sorted oldest-first.
   */
  public async getWorkflowHistory(refNo: string): Promise<IWorkflowHistoryEntry[]> {
    const base = `${getSiteUrl()}/_api/web/lists/GetByTitle('${LIST_NAMES.PA_WORKFLOW_HISTORY}')/items`;
    const select =
      `$select=${WORKFLOW_HISTORY_FIELDS.REF_NO},${WORKFLOW_HISTORY_FIELDS.USER_DISPLAY_NAME},` +
      `${WORKFLOW_HISTORY_FIELDS.ACTION},${WORKFLOW_HISTORY_FIELDS.COMMENT},Created,Author/Title&$expand=Author`;

    const encodedRef = refNo.replace(/'/g, "''");
    let items: ISharePointItem[];
    const filtered = await this.fetchAllPaged(
      `${base}?$filter=${WORKFLOW_HISTORY_FIELDS.REF_NO} eq '${encodedRef}'&${select}&$top=${LIST_PAGE_SIZE}`,
    );
    if (filtered.ok) {
      items = filtered.items;
    } else {
      const all = await this.fetchAllPaged(`${base}?${select}&$top=${LIST_PAGE_SIZE}`);
      items = all.items.filter((row) => String(row[WORKFLOW_HISTORY_FIELDS.REF_NO] ?? '') === refNo);
    }

    return items
      .map((item): IWorkflowHistoryEntry => {
        const author = item.Author as { Title?: string } | undefined;
        return {
          user: String(item[WORKFLOW_HISTORY_FIELDS.USER_DISPLAY_NAME] ?? author?.Title ?? ''),
          action: String(item[WORKFLOW_HISTORY_FIELDS.ACTION] ?? ''),
          comment: String(item[WORKFLOW_HISTORY_FIELDS.COMMENT] ?? ''),
          date: String(item.Created ?? ''),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Lists a transaction's attachments from the PA Documents library (files keyed by
   * Ref No / Title). Tries a server-side $filter first, then fetch-all + client filter.
   */
  public async getTransactionAttachments(refNo: string): Promise<IAttachmentFile[]> {
    const base = `${getSiteUrl()}/_api/web/lists/GetByTitle('${LIST_NAMES.PA_DOCUMENTS}')/items`;
    const select = '$select=FileLeafRef,FileRef,Title,TPMNo';

    const encodedRef = refNo.replace(/'/g, "''");
    let items: ISharePointItem[];
    const filtered = await this.fetchAllPaged(
      `${base}?$filter=Title eq '${encodedRef}'&${select}&$top=${LIST_PAGE_SIZE}`,
    );
    if (filtered.ok) {
      items = filtered.items;
    } else {
      const all = await this.fetchAllPaged(`${base}?${select}&$top=${LIST_PAGE_SIZE}`);
      items = all.items.filter((row) => String(row.Title ?? '') === refNo);
    }

    const origin = new URL(getSiteUrl()).origin;
    return items
      .filter((item) => item.FileRef)
      .map((item): IAttachmentFile => {
        const fileRef = String(item.FileRef);
        return {
          name: String(item.FileLeafRef ?? fileRef.split('/').pop() ?? 'file'),
          url: fileRef.indexOf('http') === 0 ? fileRef : `${origin}${fileRef}`,
        };
      });
  }

  /**
   * Uploads one file to the PA Documents library and tags it with the transaction's Ref No
   * (the `Title` field getTransactionAttachments matches on). The upload itself is a plain
   * `Files/add`; tagging is a second, best-effort MERGE — if it fails the file is still on
   * SharePoint, it just won't show up under this Ref No until re-tagged.
   */
  private async uploadOneAttachment(refNo: string, file: File): Promise<void> {
    const listName = LIST_NAMES.PA_DOCUMENTS;
    const safeFileName = file.name.replace(/'/g, "''");
    const addUrl =
      `${getSiteUrl()}/_api/web/lists/GetByTitle('${listName}')/RootFolder/Files/` +
      `add(url='${safeFileName}',overwrite=true)`;

    let serverRelativeUrl: string | undefined;
    try {
      const fileBuffer = await file.arrayBuffer();
      const response = await api.post<{ ServerRelativeUrl?: string }>(addUrl, fileBuffer, {
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      serverRelativeUrl = response.data.ServerRelativeUrl;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      throw new Error(`อัปโหลดไฟล์ "${file.name}" ไม่สำเร็จ (HTTP ${status ?? 'unknown'}).`);
    }

    if (!serverRelativeUrl) return;

    try {
      const safeServerRelativeUrl = serverRelativeUrl.replace(/'/g, "''");
      const itemResponse = await api.get<{ Id?: number }>(
        `${getSiteUrl()}/_api/web/GetFileByServerRelativeUrl('${safeServerRelativeUrl}')/ListItemAllFields?$select=Id`,
      );
      const itemId = itemResponse.data.Id;
      if (!itemId) return;

      await api.post(
        `${getSiteUrl()}/_api/web/lists/GetByTitle('${listName}')/items(${itemId})`,
        { Title: refNo },
        { headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' } },
      );
    } catch {
      // Non-fatal — see doc comment above.
    }
  }

  /** Uploads each file to PA Documents, tagging it with the transaction's Ref No. Per-file
   * failures are collected rather than aborting the rest of the batch. */
  public async uploadAttachments(
    refNo: string,
    files: File[],
  ): Promise<{ succeeded: string[]; failed: Array<{ name: string; message: string }> }> {
    const succeeded: string[] = [];
    const failed: Array<{ name: string; message: string }> = [];

    for (const file of files) {
      try {
        await this.uploadOneAttachment(refNo, file);
        succeeded.push(file.name);
      } catch (error) {
        failed.push({ name: file.name, message: error instanceof Error ? error.message : String(error) });
      }
    }

    return { succeeded, failed };
  }

  /** True if a Promotion Activities Detail item already exists for this TPM number. */
  public async promotionExists(tpmNo: string): Promise<boolean> {
    const items = await this.getItemsByTPMNo(
      LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL,
      tpmNo,
      '$select=Id,TPMNo',
    );
    return items.length > 0;
  }

  private async deleteItemById(listName: string, id: number): Promise<void> {
    const url = `${getSiteUrl()}/_api/web/lists/getbytitle('${listName}')/items(${id})`;
    try {
      await api.post(url, null, { headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' } });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const detail = axios.isAxiosError(error) ? JSON.stringify(error.response?.data ?? '') : String(error);
      throw new Error(`ลบรายการ "${listName}" (id ${id}) ไม่สำเร็จ (HTTP ${status ?? 'unknown'}). ${detail}`);
    }
  }

  /** Builds a Description -> Id map for one master list (small lists; no threshold risk). */
  private async loadDescriptionIdMap(listName: string): Promise<Record<string, number>> {
    const base = `${getSiteUrl()}/_api/web/lists/GetByTitle('${listName}')/items`;
    const result = await this.fetchAllPaged(`${base}?$select=Id,Description&$top=${LIST_PAGE_SIZE}`);
    const map: Record<string, number> = {};
    for (const item of result.items) {
      const description = item.Description;
      if (description !== null && description !== undefined && description !== '') {
        map[String(description)] = Number(item.Id);
      }
    }
    return map;
  }

  /** Loads every lookup master list once so the form's display values can be saved as ids. */
  public async loadLookupIdMaps(): Promise<ILookupIdMaps> {
    const [customerSubGroup, promotionMonth, promotionType, category, accountName, majorGroupName] =
      await Promise.all([
        this.loadDescriptionIdMap(LIST_NAMES.CUSTOMER_SUB_GROUP),
        this.loadDescriptionIdMap(LIST_NAMES.MONTH),
        this.loadDescriptionIdMap(LIST_NAMES.PROMOTION_TYPE),
        this.loadDescriptionIdMap(LIST_NAMES.CATEGORY),
        this.loadDescriptionIdMap(LIST_NAMES.ACCOUNT_NAME),
        this.loadDescriptionIdMap(LIST_NAMES.MAJOR_GROUP_NAME),
      ]);
    return { customerSubGroup, promotionMonth, promotionType, category, accountName, majorGroupName };
  }

  public getFiscalYearOptions(): Promise<IOption[]> {
    return fetchFiscalYearOptions();
  }

  /** Resolves a lookup option's display value to its master-list item id, or undefined. */
  private resolveId(map: Record<string, number>, value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return map[String(value)];
  }

  private postItem(listName: string, body: object): Promise<unknown> {
    return api.post(`${getSiteUrl()}/_api/web/lists/getbytitle('${listName}')/items`, body);
  }

  /**
   * The Detail columns the form owns. Deliberately excludes the item's identity
   * (`Title`/`Transaction`, set once at creation — see saveRequisition) and every column owned by
   * the workflow engine (`WorkflowStatus`, `PendingUser`, the approval flags, `ExpectedToClose`,
   * `Delay`, the `…Adjust` totals), so updating a requisition never clears them.
   */
  private buildDetailFields(
    header: IRequisitionSaveHeader,
    transaction: IRequisitionTransaction,
    maps: ILookupIdMaps,
  ): object {
    const summary = transaction.tebles[0];
    // Per-transaction TI/TD totals (the header carries only the grand totals).
    const spendingTI = sumCommittedByType(transaction.EstimatedPromotionExpense, TITD_TYPE.TI);
    const spendingTD = sumCommittedByType(transaction.EstimatedPromotionExpense, TITD_TYPE.TD);
    const categoryValue = summary && summary.Category ? (summary.Category.value as string | number) : undefined;
    const categoryId = this.resolveId(maps.category, categoryValue);

    return {
      TPMNo: header.tpmNo,
      Fiscal: header.fiscalYearValue,
      MechanicsDetails: transaction.MechanicsDetails,
      Comments: transaction.Comment,
      W1_x002d_2: summary ? summary.W12 : false,
      W3_x002d_4: summary ? summary.W34 : false,
      Status: header.status,
      // Amount = the transaction's committed spend (TI + TD).
      Amount: spendingTI + spendingTD,
      Total_x0020_Spending_x0020_TI: spendingTI,
      TotalSpendingTICommitted: spendingTI,
      Total_x0020_Spending_x0020_TD: spendingTD,
      TotalSpendingTDCommitted: spendingTD,
      // Lookups are written by id; an unresolved value is omitted rather than rejected.
      // Multi-value lookup (Category) is a plain id array under odata=nometadata.
      CustomerSubGroupId: this.resolveId(maps.customerSubGroup, header.channelValue),
      PromotionMonthId: this.resolveId(maps.promotionMonth, header.promotionMonthValue),
      PromotionTypeId: this.resolveId(maps.promotionType, this.optionValue(summary?.PromotionType)),
      CategoryId: categoryId === undefined ? undefined : [categoryId],
    };
  }

  /** Charge-to-CBU columns. `Title` joins the row to its parent Detail item's Ref No. */
  private buildCbuFields(tpmNo: string, title: string, cbu: IChargeToCBURow, maps: ILookupIdMaps): object {
    return {
      Title: title,
      TPMNo: tpmNo,
      Allocation: Number(cbu.Allocation),
      MajorGroupNameId: this.resolveId(maps.majorGroupName, this.optionValue(cbu.MajorGroupName)),
    };
  }

  /** Estimated-expense columns. `Title` joins the row to its parent Detail item's Ref No. */
  private buildExpenseFields(tpmNo: string, title: string, expense: IExpenseRow, maps: ILookupIdMaps): object {
    return {
      Title: title,
      TPMNo: tpmNo,
      Committed: Number(expense.Committed) || 0,
      Adjust: Number(expense.Adjust) || 0,
      ClosedExpense: Boolean(expense.Closed),
      ExpenseTypeId: expense.TITDType === TITD_TYPE.TD ? EXPENSE_TYPE_ID.TD : EXPENSE_TYPE_ID.TI,
      Account_x0020_NameId: this.resolveId(maps.accountName, this.optionValue(expense.ExpenseType)),
    };
  }

  /** POSTs one item and throws a detailed error on failure (never swallow write errors). */
  private async createItem(listName: string, body: object): Promise<void> {
    try {
      await api.post(`${getSiteUrl()}/_api/web/lists/getbytitle('${listName}')/items`, body);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const detail = axios.isAxiosError(error) ? JSON.stringify(error.response?.data ?? '') : String(error);
      throw new Error(`บันทึกลงรายการ "${listName}" ไม่สำเร็จ (HTTP ${status ?? 'unknown'}). ${detail}`);
    }
  }

  /**
   * MERGEs one item: only the fields present in `body` are written, so columns this app does not
   * own keep their current values (SharePoint has no PATCH verb — the update is a POST with
   * `X-HTTP-Method: MERGE`).
   */
  private async updateItem(listName: string, id: number, body: object): Promise<void> {
    const url = `${getSiteUrl()}/_api/web/lists/getbytitle('${listName}')/items(${id})`;
    try {
      await api.post(url, body, { headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' } });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const detail = axios.isAxiosError(error) ? JSON.stringify(error.response?.data ?? '') : String(error);
      throw new Error(
        `แก้ไขรายการ "${listName}" (id ${id}) ไม่สำเร็จ (HTTP ${status ?? 'unknown'}). ${detail}`,
      );
    }
  }

  /** Reads an option's display value (used as the key into a lookup id map). */
  private optionValue(option: IOption | null | undefined): string | number | undefined {
    return option ? (option.value as string | number) : undefined;
  }

  /** Deletes the stored items whose ids the form no longer holds (rows the user removed). */
  private async deleteRemovedItems(
    listName: string,
    storedItems: ISharePointItem[],
    keptIds: Set<number>,
  ): Promise<void> {
    for (const item of storedItems) {
      const id = Number(item.Id);
      if (id && !keptIds.has(id)) await this.deleteItemById(listName, id);
    }
  }

  /**
   * Persists an e-Requisition by reconciling the form against what is already stored, rather
   * than replacing the whole set: rows loaded from SharePoint (they carry an `Id`) are UPDATED in
   * place, rows added in the form are CREATED, and stored rows the form no longer holds are
   * DELETED individually. That keeps each item's id, Ref No, workflow state, and version history
   * intact across edits. Files staged in the Attachment modal are uploaded here too, once each
   * item's real Ref No is known.
   *
   * Ref No (`Title`) and `Transaction` are assigned once, when an item is created, and never
   * rewritten — the form renumbers its rows for display when one is deleted, but attachments and
   * workflow history are keyed by Ref No, so re-numbering stored items would orphan them. New
   * transactions therefore continue from the highest stored number (gaps are expected).
   *
   * Attachment upload failures are RETURNED, not thrown: the requisition itself is already saved
   * by then, so the caller reports them without implying the save failed.
   */
  public async saveRequisition(
    header: IRequisitionSaveHeader,
    transactions: IRequisitionTransaction[],
    maps: ILookupIdMaps,
  ): Promise<{ ok: boolean; attachmentFailures: Array<{ name: string; message: string }> }> {
    const detailList = LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL;
    const expenseList = LIST_NAMES.PROMOTION_ACTIVITIES_EXPENSES;
    const cbuList = LIST_NAMES.PROMOTION_ACTIVITIES_CHARGE_TO_CBU;

    // What is stored right now, so removals can be detected and new Ref Nos can't collide.
    const [storedDetails, storedExpenses, storedCbus] = await Promise.all([
      this.getItemsByTPMNo(detailList, header.tpmNo, '$select=Id,TPMNo,Transaction'),
      this.getItemsByTPMNo(expenseList, header.tpmNo, '$select=Id,TPMNo'),
      this.getItemsByTPMNo(cbuList, header.tpmNo, '$select=Id,TPMNo'),
    ]);

    let lastTransactionNo = storedDetails.reduce(
      (highest, item) => Math.max(highest, Number(item.Transaction) || 0),
      0,
    );

    const keptDetailIds = new Set<number>();
    const keptExpenseIds = new Set<number>();
    const keptCbuIds = new Set<number>();
    const attachmentFailures: Array<{ name: string; message: string }> = [];

    for (const transaction of transactions) {
      const detailFields = this.buildDetailFields(header, transaction, maps);
      let title: string;

      if (transaction.Id) {
        keptDetailIds.add(transaction.Id);
        title = transaction.Title ?? `${header.tpmNo}-${transaction.tebles[0]?.Transaction ?? ''}`;
        await this.updateItem(detailList, transaction.Id, detailFields);
      } else {
        lastTransactionNo += 1;
        title = `${header.tpmNo}-${lastTransactionNo}`;
        await this.createItem(detailList, {
          ...detailFields,
          Title: title,
          Transaction: lastTransactionNo,
        });
      }

      for (const cbu of transaction.ChargeToCBU) {
        const body = this.buildCbuFields(header.tpmNo, title, cbu, maps);
        if (cbu.Id) {
          keptCbuIds.add(cbu.Id);
          await this.updateItem(cbuList, cbu.Id, body);
        } else {
          await this.createItem(cbuList, body);
        }
      }

      for (const expense of transaction.EstimatedPromotionExpense) {
        const body = this.buildExpenseFields(header.tpmNo, title, expense, maps);
        if (expense.Id) {
          keptExpenseIds.add(expense.Id);
          await this.updateItem(expenseList, expense.Id, body);
        } else {
          await this.createItem(expenseList, body);
        }
      }

      // `title` is the Ref No the item actually carries, which is what attachments key on —
      // not the transaction number the form happens to be displaying.
      const stagedFiles = (transaction.pendingAttachments ?? []).filter((file): file is File => file !== null);
      if (stagedFiles.length > 0) {
        const uploaded = await this.uploadAttachments(title, stagedFiles);
        attachmentFailures.push(...uploaded.failed);
      }
    }

    // Deletions run last so a failure part-way through never loses data that has no replacement.
    await this.deleteRemovedItems(detailList, storedDetails, keptDetailIds);
    await this.deleteRemovedItems(expenseList, storedExpenses, keptExpenseIds);
    await this.deleteRemovedItems(cbuList, storedCbus, keptCbuIds);

    return { ok: true, attachmentFailures };
  }
}
