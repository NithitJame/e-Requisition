// Column definitions for the three RequestPA data tables.
// Kept separate from TransactionSection so each file stays focused and small.

import * as React from 'react';
import { TableColumn } from 'react-data-table-component';

import SearchableSelect from '@/shared/components/SearchableSelect';
import { MAJOR_GROUP_OPTIONS } from '@/features/pa/constants';
import { categoryOptions, expenseOptions, promotionOptions } from '@/features/pa/constants/filterOptions';
import {
  IChargeToCBURow,
  IExpenseRow,
  IRequisitionFormHandlers,
  ITransactionRow,
} from '@/features/pa/types';

const RequiredMark = (): React.ReactElement => <span className="text-danger">*</span>;

/**
 * Columns for the per-transaction summary table.
 * @param disabled read-only (view) mode — disables Promotion Type / Category / week checkboxes.
 * @param onOpenAttachment opens the attachments viewer for a transaction's Ref No.
 * @param tpmNo the e-Requisition prefix, used to build each row's Ref No ("TPMNo-Transaction").
 */
export function getTransactionColumns(
  disabled: boolean,
  handlers: IRequisitionFormHandlers,
  onOpenAttachment: (refNo: string) => void,
  tpmNo: string,
): TableColumn<ITransactionRow>[] {
  return [
    {
      name: 'Transaction',
      selector: (row) => row.Transaction,
      sortable: false,
      width: '95px',
    },
    {
      name: <>Promotion Type <RequiredMark /></>,
      cell: (row) => (
        <div className="w-100">
          <SearchableSelect
            isMulti={false}
            options={promotionOptions}
            value={row.PromotionType}
            onChange={(option) => handlers.updateTransactionRow(row, 'PromotionType', option)}
            placeholder="Please select"
            disabled={disabled}
          />
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      width: '180px',
    },
    {
      name: <>Category <RequiredMark /></>,
      cell: (row) => (
        <div className="w-100">
          <SearchableSelect
            isMulti={false}
            options={categoryOptions}
            value={row.Category}
            onChange={(option) => handlers.updateTransactionRow(row, 'Category', option)}
            placeholder="Please select"
            disabled={disabled}
          />
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      width: '250px',
    },
    {
      name: 'W1-2',
      cell: (row) => (
        <div className="w-100">
          <input
            type="checkbox"
            className="form-check-input"
            checked={row.W12}
            onChange={() => handlers.updateTransactionRow(row, 'W12', !row.W12)}
            disabled={disabled}
          />
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      width: '95px',
    },
    {
      name: 'W3-4',
      cell: (row) => (
        <div className="w-100">
          <input
            type="checkbox"
            className="form-check-input"
            checked={row.W34}
            onChange={() => handlers.updateTransactionRow(row, 'W34', !row.W34)}
            disabled={disabled}
          />
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      width: '95px',
    },
    {
      name: 'Attachment',
      cell: (row) => (
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-secondary rounded-xl"
            onClick={() => onOpenAttachment(`${tpmNo}-${row.Transaction}`)}
          >
            <i className="fa fa-paperclip me-1" /> Attachment
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: '180px',
    },
    {
      name: 'Amount',
      selector: (row) => row.Amount,
      sortable: false,
      width: '150px',
    },
    {
      name: 'Status',
      selector: (row) => row.Status ?? '',
      sortable: false,
      width: '95px',
    },
    {
      name: 'Closed',
      cell: () => (
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary rounded-xl" disabled>
            Closed
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: '95px',
    },
  ];
}

/** Columns for the Estimated Promotion Expense table. */
export function getExpenseColumns(
  parentIndex: number,
  disabled: boolean,
  handlers: IRequisitionFormHandlers,
): TableColumn<IExpenseRow>[] {
  return [
    {
      name: <>Expense Type <RequiredMark /></>,
      cell: (row, rowIndex) => {
        const selectedValue =
          typeof row.ExpenseType === 'object'
            ? row.ExpenseType
            : expenseOptions.find((option) => option.value === String(row.ExpenseType)) ?? null;
        return (
          <div className="w-100">
            <SearchableSelect
              isMulti={false}
              options={expenseOptions}
              value={selectedValue}
              onChange={(option) => handlers.updateExpenseRow(parentIndex, rowIndex, 'ExpenseType', option)}
              placeholder="Please select"
              disabled={disabled}
            />
          </div>
        );
      },
      ignoreRowClick: true,
      allowOverflow: true,
      width: '250px',
    },
    {
      name: 'TITDType',
      cell: (row) => (
        <input
          type="text"
          className="form-control form-control-sm text-center"
          value={row.TITDType || ''}
          disabled
        />
      ),
      width: '100px',
    },
    {
      name: <>Committed <RequiredMark /></>,
      cell: (row, rowIndex) => (
        <input
          type="number"
          className="form-control form-control-sm text-end"
          value={row.Committed}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || Number(value) >= 0) {
              handlers.updateExpenseRow(parentIndex, rowIndex, 'Committed', value);
            }
          }}
          disabled={disabled}
        />
      ),
      width: '120px',
    },
    {
      name: 'Adjust',
      cell: (row) => (
        <input type="number" className="form-control form-control-sm text-end" value={row.Adjust} disabled />
      ),
      width: '100px',
    },
    {
      name: 'Closed',
      cell: () => (
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary rounded-xl" disabled>
            Closed
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: '95px',
    },
    {
      name: '',
      cell: (row, rowIndex) => (
        <div className="w-100 text-center">
          {rowIndex !== 0 && !disabled ? (
            <button
              className="btn btn-sm btn-outline-danger rounded-xl"
              onClick={() => handlers.removeExpenseRow(parentIndex, rowIndex)}
            >
              <i className="fa fa-close" />
            </button>
          ) : null}
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: '25px',
    },
  ];
}

/** Columns for the Charge to CBU table. */
export function getChargeToCBUColumns(
  parentIndex: number,
  disabled: boolean,
  handlers: IRequisitionFormHandlers,
): TableColumn<IChargeToCBURow>[] {
  return [
    {
      name: <>MajorGroup Name <RequiredMark /></>,
      cell: (row, rowIndex) => {
        const selectedValue =
          typeof row.MajorGroupName === 'object'
            ? row.MajorGroupName
            : MAJOR_GROUP_OPTIONS.find((option) => option.value === String(row.MajorGroupName)) ?? null;
        return (
          <div className="w-100">
            <SearchableSelect
              isMulti={false}
              options={MAJOR_GROUP_OPTIONS}
              value={selectedValue}
              onChange={(option) => handlers.updateChargeToCBURow(parentIndex, rowIndex, 'MajorGroupName', option)}
              placeholder="Please select"
              disabled={disabled}
            />
          </div>
        );
      },
      ignoreRowClick: true,
      allowOverflow: true,
      width: '200px',
    },
    {
      name: 'Category',
      cell: (row) => (
        <input type="text" className="form-control form-control-sm text-end" value={row.Category} disabled />
      ),
      width: '120px',
    },
    {
      name: 'Allocation',
      cell: (row, rowIndex) => (
        <input
          type="number"
          className="form-control form-control-sm text-end"
          value={row.Allocation}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || Number(value) >= 0) {
              handlers.updateChargeToCBURow(parentIndex, rowIndex, 'Allocation', value);
            }
          }}
          disabled={disabled}
        />
      ),
      width: '120px',
    },
    {
      name: '',
      cell: (row, rowIndex) => (
        <div className="w-100 text-center">
          {rowIndex !== 0 && !disabled ? (
            <button
              className="btn btn-sm btn-outline-danger rounded-xl"
              onClick={() => handlers.removeChargeToCBURow(parentIndex, rowIndex)}
            >
              <i className="fa fa-close" />
            </button>
          ) : null}
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: '25px',
    },
  ];
}
