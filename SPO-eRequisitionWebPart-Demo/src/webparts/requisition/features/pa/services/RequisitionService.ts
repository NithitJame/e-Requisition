// All SharePoint REST access for the e-Requisition web part lives here.
// Components/hooks never call SPHttpClient directly (see docs/CONVENTIONS.md §6).

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

import {
  EXPENSE_TYPE_ID,
  LIST_NAMES,
  LIST_PAGE_SIZE,
  TITD_TYPE,
  WORKFLOW_HISTORY_FIELDS,
} from '@/features/pa/constants';
import { sumCommittedByType } from '@/features/pa/utils/totals';
import {
  IAttachmentFile,
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

const SELECT_EXPAND = {
  PAD:
    '$select=Title,TPMNo,Transaction,Fiscal,MechanicsDetails,Comments,Amount,Status,' +
    'W1_x002d_2,W3_x002d_4,TotalSpendingTICommitted,TotalSpendingTDCommitted,' +
    'CustomerSubGroup/Description,PromotionMonth/Description,PromotionType/Description,Category/Description' +
    '&$expand=CustomerSubGroup,PromotionMonth,PromotionType,Category',
  EXPENSES:
    '$select=Title,TPMNo,Committed,Adjust,ClosedExpense,' +
    'Account_x0020_Name/Description,ExpenseType/Description&$expand=Account_x0020_Name,ExpenseType',
  CBU: '$select=Title,TPMNo,Allocation,MajorGroupName/Description&$expand=MajorGroupName',
};

const WRITE_HEADERS = {
  Accept: 'application/json;odata=nometadata',
  'Content-Type': 'application/json;odata=nometadata',
  'odata-version': '',
};

export class RequisitionService {
  public constructor(
    private readonly spHttpClient: SPHttpClient,
    private readonly siteUrl: string,
  ) {}

  /** Fetches every item across pages; ok=false if any request fails (e.g. list view threshold). */
  private async fetchAllPaged(url: string): Promise<IPagedResult> {
    let items: ISharePointItem[] = [];
    let nextUrl: string | undefined = url;

    while (nextUrl) {
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        nextUrl,
        SPHttpClient.configurations.v1,
      );
      if (!response.ok) return { ok: false, items: [] };
      const json = await response.json();
      if (json.value) items = [...items, ...json.value];
      nextUrl = json['@odata.nextLink'];
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
    const base = `${this.siteUrl}/_api/web/lists/GetByTitle('${listName}')/items`;
    const filtered = await this.fetchAllPaged(
      `${base}?$filter=TPMNo eq '${tpmNo}'&${selectExpand}&$top=${LIST_PAGE_SIZE}`,
    );
    if (filtered.ok) return filtered.items;

    const all = await this.fetchAllPaged(`${base}?${selectExpand}&$top=${LIST_PAGE_SIZE}`);
    return all.items.filter((row) => row.TPMNo === tpmNo);
  }

  /** Builds a map of MajorGroupName (Description) -> Category from M_MajorGroupName. */
  private async loadMajorGroupCategoryMap(): Promise<Record<string, string>> {
    const base = `${this.siteUrl}/_api/web/lists/GetByTitle('${LIST_NAMES.MAJOR_GROUP_NAME}')/items`;

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
    const base = `${this.siteUrl}/_api/web/lists/GetByTitle('${LIST_NAMES.PA_WORKFLOW_HISTORY}')/items`;
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
    const base = `${this.siteUrl}/_api/web/lists/GetByTitle('${LIST_NAMES.PA_DOCUMENTS}')/items`;
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

    const origin = new URL(this.siteUrl).origin;
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

  /** True if a Promotion Activities Detail item already exists for this TPM number. */
  public async promotionExists(tpmNo: string): Promise<boolean> {
    const items = await this.getItemsByTPMNo(
      LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL,
      tpmNo,
      '$select=Id,TPMNo',
    );
    return items.length > 0;
  }

  /** Deletes every Detail/Expense/CBU item for a TPM number (used to replace on edit). */
  public async deleteRequisition(tpmNo: string): Promise<void> {
    await this.deleteItemsByTPMNo(LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL, tpmNo);
    await this.deleteItemsByTPMNo(LIST_NAMES.PROMOTION_ACTIVITIES_EXPENSES, tpmNo);
    await this.deleteItemsByTPMNo(LIST_NAMES.PROMOTION_ACTIVITIES_CHARGE_TO_CBU, tpmNo);
  }

  private async deleteItemsByTPMNo(listName: string, tpmNo: string): Promise<void> {
    const items = await this.getItemsByTPMNo(listName, tpmNo, '$select=Id,TPMNo');
    for (const item of items) {
      await this.deleteItemById(listName, Number(item.Id));
    }
  }

  private async deleteItemById(listName: string, id: number): Promise<void> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${id})`;
    const response = await this.spHttpClient.post(url, SPHttpClient.configurations.v1, {
      headers: { ...WRITE_HEADERS, 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' },
    });
    if (response.ok) return;
    const detail = await response.text().catch(() => '');
    throw new Error(
      `ลบรายการ "${listName}" (id ${id}) ไม่สำเร็จ (HTTP ${response.status} ${response.statusText}). ${detail}`,
    );
  }

  /** Builds a Description -> Id map for one master list (small lists; no threshold risk). */
  private async loadDescriptionIdMap(listName: string): Promise<Record<string, number>> {
    const base = `${this.siteUrl}/_api/web/lists/GetByTitle('${listName}')/items`;
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

  /** Resolves a lookup option's display value to its master-list item id, or undefined. */
  private resolveId(map: Record<string, number>, value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return map[String(value)];
  }

  private postItem(listName: string, body: object): Promise<SPHttpClientResponse> {
    return this.spHttpClient.post(
      `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items`,
      SPHttpClient.configurations.v1,
      { headers: WRITE_HEADERS, body: JSON.stringify(body) },
    );
  }

  private createDetailItem(
    header: IRequisitionSaveHeader,
    transaction: IRequisitionTransaction,
    maps: ILookupIdMaps,
  ): Promise<void> {
    const summary = transaction.tebles[0];
    // Per-transaction TI/TD totals (the header carries only the grand totals).
    const spendingTI = sumCommittedByType(transaction.EstimatedPromotionExpense, TITD_TYPE.TI);
    const spendingTD = sumCommittedByType(transaction.EstimatedPromotionExpense, TITD_TYPE.TD);
    const categoryValue = summary && summary.Category ? (summary.Category.value as string | number) : undefined;
    const categoryId = this.resolveId(maps.category, categoryValue);

    return this.createItem(LIST_NAMES.PROMOTION_ACTIVITIES_DETAIL, {
      Title: this.buildTitle(header.tpmNo, transaction),
      TPMNo: header.tpmNo,
      Fiscal: header.fiscalYearValue,
      Transaction: summary ? summary.Transaction : '',
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
    });
  }

  private async createChildItems(
    header: IRequisitionSaveHeader,
    transaction: IRequisitionTransaction,
    maps: ILookupIdMaps,
  ): Promise<void> {
    const requests: Promise<void>[] = [];
    // Children join to their parent Detail row by Title (TPMNo + transaction number).
    const title = this.buildTitle(header.tpmNo, transaction);

    for (const cbu of transaction.ChargeToCBU) {
      requests.push(
        this.createItem(LIST_NAMES.PROMOTION_ACTIVITIES_CHARGE_TO_CBU, {
          Title: title,
          TPMNo: header.tpmNo,
          Allocation: Number(cbu.Allocation),
          MajorGroupNameId: this.resolveId(maps.majorGroupName, this.optionValue(cbu.MajorGroupName)),
        }),
      );
    }

    for (const expense of transaction.EstimatedPromotionExpense) {
      requests.push(
        this.createItem(LIST_NAMES.PROMOTION_ACTIVITIES_EXPENSES, {
          Title: title,
          TPMNo: header.tpmNo,
          Committed: Number(expense.Committed) || 0,
          Adjust: Number(expense.Adjust) || 0,
          ClosedExpense: Boolean(expense.Closed),
          ExpenseTypeId: expense.TITDType === TITD_TYPE.TD ? EXPENSE_TYPE_ID.TD : EXPENSE_TYPE_ID.TI,
          Account_x0020_NameId: this.resolveId(maps.accountName, this.optionValue(expense.ExpenseType)),
        }),
      );
    }

    await Promise.all(requests);
  }

  /** POSTs one item and throws a detailed error on failure (never swallow write errors). */
  private async createItem(listName: string, body: object): Promise<void> {
    const response = await this.postItem(listName, body);
    if (response.ok) return;
    const detail = await response.text().catch(() => '');
    throw new Error(
      `บันทึกลงรายการ "${listName}" ไม่สำเร็จ (HTTP ${response.status} ${response.statusText}). ${detail}`,
    );
  }

  /** Reads an option's display value (used as the key into a lookup id map). */
  private optionValue(option: IOption | null | undefined): string | number | undefined {
    return option ? (option.value as string | number) : undefined;
  }

  /** Unique Detail Title: TPMNo + the transaction number, e.g. "DAPA2526-12-1". */
  private buildTitle(tpmNo: string, transaction: IRequisitionTransaction): string {
    const summary = transaction.tebles[0];
    return `${tpmNo}-${summary ? summary.Transaction : ''}`;
  }

  /** Creates a Promotion Activities Detail item plus its CBU/Expense children per transaction. */
  public async saveRequisition(
    header: IRequisitionSaveHeader,
    transactions: IRequisitionTransaction[],
    maps: ILookupIdMaps,
  ): Promise<{ ok: boolean }> {
    for (const transaction of transactions) {
      await this.createDetailItem(header, transaction, maps);
      await this.createChildItems(header, transaction, maps);
    }
    return { ok: true };
  }
}
