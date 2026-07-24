// Column definitions for the AllPA listing table. Kept separate from the page shell so each
// file stays focused and small (mirrors RequestPA.columns.tsx).

import * as React from 'react';
import { TableColumn } from 'react-data-table-component';

import { IPromotionActivityRow } from '@/features/pa/types';

/** Formats a numeric total with thousands separators, or "-" when absent. */
function formatNumber(value: number | undefined): string {
  return value !== undefined && value !== null ? Number(value).toLocaleString() : '-';
}

/**
 * Builds the shared "All Promotion Activities" business columns (View + the 17 read-only
 * fields). Generic over the row type so the Approve page can reuse them with its own row
 * shape (IApprovalInboxRow) and append approval columns.
 * @param onView called with the row when the "View" action is clicked.
 */
export function getAllPaColumns<T extends IPromotionActivityRow>(
  onView: (row: T) => void,
): TableColumn<T>[] {
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
    {
      name: 'Status',
      selector: (row) => row.WorkflowStatus?.LookupValue || '-',
      sortable: false,
      width: '150px',
    },
    {
      name: 'Category',
      selector: (row) => (row.Category.length > 0 ? row.Category.map((c) => c.LookupValue).join(', ') : '-'),
      sortable: false,
      width: '150px',
    },
    {
      name: 'E-Requisition No.',
      selector: (row) => row.TPMNo || '-',
      sortable: false,
      width: '150px',
    },
    {
      name: 'Transaction',
      selector: (row) => row.Transaction || '-',
      sortable: false,
      width: '150px',
    },
    {
      name: 'Channel',
      selector: (row) => row.CustomerSubGroup?.LookupValue || '-',
      sortable: false,
      width: '120px',
    },
    {
      name: 'Promotion Type',
      selector: (row) => row.PromotionType?.LookupValue || '-',
      sortable: false,
      width: '120px',
    },
    {
      name: 'Promotion Month',
      selector: (row) => row.PromotionMonth?.LookupValue || '-',
      sortable: false,
      width: '150px',
    },
    {
      name: 'Promotion Week',
      selector: (row) => row.PromotionWeek || '-',
      sortable: false,
      width: '150px',
    },
    {
      name: 'TI-Committed',
      selector: (row) => formatNumber(row.TotalSpendingTICommitted),
      sortable: false,
      width: '150px',
    },
    {
      name: 'TD-Committed',
      selector: (row) => formatNumber(row.TotalSpendingTDCommitted),
      sortable: false,
      width: '150px',
    },
    {
      name: 'TI-Committed Adjust',
      selector: (row) => formatNumber(row.TotalSpendingTIAdjust),
      sortable: false,
      width: '190px',
    },
    {
      name: 'TD-Committed Adjust',
      selector: (row) => formatNumber(row.TotalSpendingTDAdjust),
      sortable: false,
      width: '190px',
    },
    {
      name: 'TI-Utilized',
      selector: (row) => formatNumber(row.TotalSpendingTI),
      sortable: false,
      width: '150px',
    },
    {
      name: 'TD-Utilized',
      selector: (row) => formatNumber(row.TotalSpendingTD),
      sortable: false,
      width: '150px',
    },
    {
      name: 'Expected to Close',
      selector: (row) => row.ExpectedToClose || '-',
      sortable: false,
      width: '190px',
    },
    {
      name: 'Delay',
      selector: (row) => row.Delay || '-',
      sortable: false,
      width: '80px',
    },
    {
      name: 'Mechanics Details',
      selector: (row) => row.MechanicsDetails || '-',
      sortable: false,
      width: 'fit-content',
    },
  ];
}
