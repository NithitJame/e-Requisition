// Column definitions for the three RequestPA data tables.
// Kept separate from TransactionSection so each file stays focused and small.

import * as React from 'react';
import { TableColumn } from 'react-data-table-component';

import SearchableSelect from '@/shared/components/SearchableSelect';
import { expenseOptions } from '@/features/pa/constants/filterOptions';
import {
  IChargeToCBURow,
  IExpenseRow,
  IMajorGroupOption,
  IOption,
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
 * @param disabled read-only (view) mode — disables Category (always locked there).
 * @param editableFields Promotion Type / W1-2 / W3-4 / Attachment stay enabled when this is true:
 * always true outside view mode, and true in view mode only while this transaction's
 * WorkflowStatus is "Open" (see TransactionSection.tsx).
 * @param onOpenAttachment opens the read-only attachments viewer (locked transactions) for a Ref No.
 * @param onOpenUpload opens the attachment upload modal (editable transactions) for this transaction.
 * @param tpmNo the e-Requisition prefix, used to build each row's Ref No ("TPMNo-Transaction").
 * @param transactionIndex this transaction's position in the form's transactions array — the
 * upload modal stages files on the transaction itself, so it needs the array index, not just
 * the (possibly not-yet-final) displayed Ref No.
 */
export function getTransactionColumns(
  disabled: boolean,
  editableFields: boolean,
  handlers: IRequisitionFormHandlers,
  onOpenAttachment: (refNo: string) => void,
  onOpenUpload: (transactionIndex: number, refNo: string) => void,
  tpmNo: string,
  transactionIndex: number,
  promotionOptions: IOption[],
  categoryOptions: IOption[],
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
            disabled={!editableFields}
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
            disabled={!editableFields}
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
            disabled={!editableFields}
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
            onClick={() => {
              const refNo = `${tpmNo}-${row.Transaction}`;
              if (editableFields) {
                onOpenUpload(transactionIndex, refNo);
              } else {
                onOpenAttachment(refNo);
              }
            }}
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

/**
 * Columns for the Estimated Promotion Expense table.
 * @param disabled read-only (view) mode.
 * @param editableFields Expense Type / Committed stay enabled when this is true: always true
 * outside view mode, and true in view mode only while the parent transaction's WorkflowStatus is
 * "Open". A row can only be removed here if it was added this session (no `Id` yet) — pre-existing
 * rows are never deletable from this limited inline edit, unlike the full create/edit flow.
 */
export function getExpenseColumns(
  parentIndex: number,
  disabled: boolean,
  editableFields: boolean,
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
              disabled={!editableFields}
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
      // Only ever shows "TI" or "TD".
      minWidth: '70px',
      grow: 1,
    },
    {
      name: boldHeader(<>Committed <RequiredMark /></>),
      cell: (row, rowIndex) => (
        <CommittedInput
          value={row.Committed}
          disabled={!editableFields}
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
          {rowIndex !== 0 && (!disabled || (editableFields && !row.Id)) ? (
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

/**
 * Columns for the Charge to CBU table.
 * @param disabled read-only (view) mode.
 * @param editableFields % Allocation stays enabled when this is true: always true outside view
 * mode, and true in view mode only while the parent transaction's WorkflowStatus is "Open".
 * MajorGroup Name, though, stays locked for pre-existing rows even then — only a brand-new row
 * (added this session, no `Id` yet) may have it set, matching how that row can also be removed
 * again (pre-existing rows are never deletable from this limited inline edit).
 */
export function getChargeToCBUColumns(
  parentIndex: number,
  disabled: boolean,
  editableFields: boolean,
  handlers: IRequisitionFormHandlers,
  majorGroupOptions: IMajorGroupOption[],
  allocationChecked: boolean,
  onAllocationToggle: (checked: boolean) => void,
): TableColumn<IChargeToCBURow>[] {
  return [
    {
      name: boldHeader(<>MajorGroup Name <RequiredMark /></>),
      cell: (row, rowIndex) => {
        const selectedValue =
          typeof row.MajorGroupName === 'object'
            ? row.MajorGroupName
            : majorGroupOptions.find((option) => option.value === String(row.MajorGroupName)) ?? null;
        const nameDisabled = disabled ? row.Id !== undefined || !editableFields : false;
        return (
          <div className="w-100">
            <SearchableSelect
              isMulti={false}
              options={majorGroupOptions}
              value={selectedValue}
              onChange={(option) => handlers.updateChargeToCBURow(parentIndex, rowIndex, 'MajorGroupName', option)}
              placeholder="Please select"
              disabled={nameDisabled}
            />
          </div>
        );
      },
      ignoreRowClick: true,
      allowOverflow: true,
      // Wide enough for the longest MajorGroup Name label (e.g. "PASTEURIZE DARK COCOA")
      // plus the select's clear/chip UI.
      minWidth: '240px',
      grow: 0,
    },
    {
      name: boldHeader('Category'),
      cell: (row) => (
        <input type="text" className="form-control text-end" value={row.Category} disabled />
      ),
      // Wide enough to show the longest Category value (e.g. "CONFECTIONERY") in full.
      minWidth: '110px',
      grow: 1.2,
    },
    {
      name: (
        <div className="d-flex align-items-center gap-1">
          <input
            type="checkbox"
            className="form-check-input mt-0"
            checked={allocationChecked}
            onChange={(e) => onAllocationToggle(e.target.checked)}
            disabled={!editableFields}
          />
          <strong>% Allocation <RequiredMark /></strong>
        </div>
      ),
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
          disabled={!editableFields}
        />
      ),
      minWidth: '100px',
      grow: 1.5,
    },
    {
      name: '',
      cell: (row, rowIndex) => (
        <div className="w-100 text-center">
          {rowIndex !== 0 && (!disabled || (editableFields && !row.Id)) ? (
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
