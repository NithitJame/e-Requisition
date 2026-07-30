// Shared business columns for the promotion/trade-agreement listing tables (View + read-only
// fields). Generic over the row type so the Approve page can extend them. Options adapt per
// screen: Category column (AllPA/Approve keep it; AllTA omits per SRS), currency (2-dp) totals,
// and truncated Mechanics with a tooltip.

import * as React from 'react';
import { TableColumn } from 'react-data-table-component';

import { IPromotionActivityRow } from '@/shared/types';
import styles from './promotionListingColumns.module.scss';

export interface IPromotionListingColumnOptions {
  /** Include the Category column (default true). AllTA omits it per its SRS column list. */
  includeCategory?: boolean;
  /** Format TI/TD amounts as currency with thousand separators + 2 decimals (right-aligned). */
  currency?: boolean;
  /** Truncate Mechanics Details with an ellipsis + full-text tooltip. */
  mechanicsTooltip?: boolean;
}

/** Formats a numeric total, optionally as currency (thousand separators, 2 decimals). */
function formatNumber(value: number | undefined, currency: boolean): string {
  if (value === undefined || value === null) return '-';
  return currency
    ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(value).toLocaleString();
}

/**
 * Builds the shared listing columns.
 * @param onView called with the row when the "View" action is clicked.
 * @param options per-screen formatting (category / currency / mechanics tooltip).
 */
export function getPromotionListingColumns<T extends IPromotionActivityRow>(
  onView: (row: T) => void,
  options: IPromotionListingColumnOptions = {},
): TableColumn<T>[] {
  const currency = options.currency === true;
  const includeCategory = options.includeCategory !== false;

  const amount = (value: (row: T) => number | undefined, name: string, width: string): TableColumn<T> => ({
    name,
    selector: (row) => formatNumber(value(row), currency),
    sortable: false,
    width,
  });

  const categoryColumn: TableColumn<T> = {
    name: 'Category',
    selector: (row) => (row.Category.length > 0 ? row.Category.map((c) => c.LookupValue).join(', ') : '-'),
    sortable: false,
    width: '150px',
  };

  const mechanicsColumn: TableColumn<T> = options.mechanicsTooltip
    ? {
        name: 'Mechanics Details',
        cell: (row) => (
          <span className={styles.mechanicsTruncate} title={row.MechanicsDetails || ''}>
            {row.MechanicsDetails || '-'}
          </span>
        ),
        sortable: false,
        width: '300px',
      }
    : {
        name: 'Mechanics Details',
        selector: (row) => row.MechanicsDetails || '-',
        sortable: false,
        width: 'fit-content',
      };

  return [
    {
      name: '',
      cell: (row) => (
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary rounded-xl" onClick={() => onView(row)}>
            <i className="fa fa-eye me-1" /> View
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: '100px',
    },
    { name: 'Status', selector: (row) => row.WorkflowStatus?.LookupValue || '-', sortable: false, width: '150px' },
    ...(includeCategory ? [categoryColumn] : []),
    { name: 'E-Requisition No.', selector: (row) => row.TPMNo || '-', sortable: false, width: '150px' },
    { name: 'Transaction', selector: (row) => row.Transaction || '-', sortable: false, width: '150px' },
    { name: 'Channel', selector: (row) => row.CustomerSubGroup?.LookupValue || '-', sortable: false, width: '120px' },
    { name: 'Promotion Type', selector: (row) => row.PromotionType?.LookupValue || '-', sortable: false, width: '120px' },
    { name: 'Promotion Month', selector: (row) => row.PromotionMonth?.LookupValue || '-', sortable: false, width: '150px' },
    { name: 'Promotion Week', selector: (row) => row.PromotionWeek || '-', sortable: false, width: '150px' },
    amount((row) => row.TotalSpendingTICommitted, 'TI-Committed', '150px'),
    amount((row) => row.TotalSpendingTDCommitted, 'TD-Committed', '150px'),
    amount((row) => row.TotalSpendingTIAdjust, 'TI-Committed Adjust', '190px'),
    amount((row) => row.TotalSpendingTDAdjust, 'TD-Committed Adjust', '190px'),
    amount((row) => row.TotalSpendingTI, 'TI-Utilized', '150px'),
    amount((row) => row.TotalSpendingTD, 'TD-Utilized', '150px'),
    { name: 'Expected to Close', selector: (row) => row.ExpectedToClose || '-', sortable: false, width: '190px' },
    { name: 'Delay', selector: (row) => row.Delay || '-', sortable: false, width: '80px' },
    mechanicsColumn,
  ];
}
