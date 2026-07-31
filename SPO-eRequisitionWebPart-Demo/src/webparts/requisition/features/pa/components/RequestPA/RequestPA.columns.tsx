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

/** Bolds a column header (RequestPA's tables only — not the shared DataTable default). */
const boldHeader = (label: React.ReactNode): React.ReactElement => <strong>{label}</strong>;

/**
 * Numeric input that shows the raw typed value while focused (so decimals can be typed
 * normally) and reformats to 2 decimals on blur. Used for "Committed", which is editable —
 * unlike "Adjust"/totals (always disabled), reformatting on every keystroke would fight typing
 * (e.g. "12." would immediately snap to "12.00", blocking further decimal entry).
 */
const CommittedInput: React.FC<{
  value: number | string;
  disabled: boolean;
  onCommit: (rawValue: string) => void;
}> = ({ value, disabled, onCommit }) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value));

  // Keep the draft in sync with external changes (e.g. loaded from server) while not editing.
  React.useEffect(() => {
    if (!isFocused) setDraft(String(value));
  }, [value, isFocused]);

  const displayValue = isFocused ? draft : (Number(value) || 0).toFixed(2);

  return (
    <input
      type="number"
      className="form-control text-end"
      value={displayValue}
      disabled={disabled}
      onFocus={() => {
        setIsFocused(true);
        setDraft(String(value));
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (next === '' || Number(next) >= 0) {
          onCommit(next);
        }
      }}
      onBlur={() => setIsFocused(false)}
    />
  );
};

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
      name: boldHeader('Transaction'),
      selector: (row) => row.Transaction,
      sortable: false,
      width: '95px',
    },
    {
      name: boldHeader(<>Promotion Type <RequiredMark /></>),
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
      minWidth: '180px',
      grow: 4,
    },
    {
      name: boldHeader(<>Category <RequiredMark /></>),
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
      minWidth: '250px',
      grow: 4,
    },
    {
      name: boldHeader('W1-2'),
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
      name: boldHeader('W3-4'),
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
      name: boldHeader('Attachment'),
      cell: (row) => (
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary rounded-xl"
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
      name: boldHeader('Amount'),
      selector: (row) => row.Amount,
      sortable: false,
      minWidth: '150px',
      grow: 2,
    },
    {
      name: boldHeader('Status'),
      selector: (row) => row.Status ?? '',
      sortable: false,
      minWidth: '95px',
      grow: 1,
    },
    {
      name: boldHeader('Closed'),
      cell: () => (
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary rounded-xl me-2" disabled>
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
      name: boldHeader(<>Expense Type <RequiredMark /></>),
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
      minWidth: '250px',
      grow: 5,
    },
    {
      name: boldHeader('TITDType'),
      cell: (row) => (
        <input
          type="text"
          className="form-control text-center"
          value={row.TITDType || ''}
          disabled
        />
      ),
      minWidth: '100px',
      grow: 2,
    },
    {
      name: boldHeader(<>Committed <RequiredMark /></>),
      cell: (row, rowIndex) => (
        <CommittedInput
          value={row.Committed}
          disabled={disabled}
          onCommit={(value) => handlers.updateExpenseRow(parentIndex, rowIndex, 'Committed', value)}
        />
      ),
      minWidth: '120px',
      grow: 2,
    },
    {
      name: boldHeader('Adjust'),
      cell: (row) => (
        <input
          type="number"
          className="form-control text-end"
          value={(Number(row.Adjust) || 0).toFixed(2)}
          disabled
        />
      ),
      minWidth: '100px',
      grow: 2,
    },
    {
      name: boldHeader('Closed'),
      cell: () => (
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary rounded-xl me-2" disabled>
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
              className="btn btn-sm btn-outline-danger rounded-xl me-2"
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
      width: '45px',
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
      name: boldHeader(<>MajorGroup Name <RequiredMark /></>),
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
      minWidth: '160px',
      grow: 0,
    },
    {
      name: boldHeader('Category'),
      cell: (row) => (
        <input type="text" className="form-control text-end" value={row.Category} disabled />
      ),
      minWidth: '90px',
      grow: 4,
    },
    {
      name: boldHeader(<>% Allocation <RequiredMark /></>),
      cell: (row, rowIndex) => (
        <input
          type="number"
          className="form-control text-end"
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
      minWidth: '100px',
      grow: 1.5,
    },
    {
      name: '',
      cell: (row, rowIndex) => (
        <div className="w-100 text-center">
          {rowIndex !== 0 && !disabled ? (
            <button
              className="btn btn-sm btn-outline-danger rounded-xl me-2"
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
      width: '45px',
    },
  ];
}
