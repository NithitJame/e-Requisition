// Column definitions for the Approve page: the shared AllPA business columns plus the
// approval controls (Approve radio, Reject radio, Comment input). Kept separate from the
// page shell so each file stays focused (mirrors AllPA.columns.tsx).

import * as React from 'react';
import { TableColumn } from 'react-data-table-component';

import { getAllPaColumns } from '@/features/pa/components/AllPA/AllPA.columns';
import { APPROVAL_ACTION } from '@/features/pa/constants';
import { IApprovalDecisionState, IApprovalInboxRow, TApprovalDecision } from '@/features/pa/types';
import styles from './ApprovePA.module.scss';

export interface IApprovePaColumnsParams {
  onView: (row: IApprovalInboxRow) => void;
  decisions: Record<number, IApprovalDecisionState>;
  submitAttempted: boolean;
  onDecision: (rowId: number, decision: TApprovalDecision) => void;
  onComment: (rowId: number, comment: string) => void;
}

/**
 * Comment input with its own local state so typing stays smooth (the parent rebuilds columns
 * on each decision change). It mirrors every change up to the hook and shows the "comment
 * required" message when the row is rejected without a comment after a submit attempt.
 */
const CommentInput: React.FC<{
  rowId: number;
  initialValue: string;
  isRejected: boolean;
  submitAttempted: boolean;
  onComment: (rowId: number, comment: string) => void;
}> = ({ rowId, initialValue, isRejected, submitAttempted, onComment }) => {
  const [value, setValue] = React.useState<string>(initialValue);
  const showError = submitAttempted && isRejected && value.trim() === '';

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setValue(event.target.value);
    onComment(rowId, event.target.value);
  };

  return (
    <div className={styles.commentCell}>
      <input
        type="text"
        className={`form-control form-control-sm ${showError ? 'is-invalid' : ''}`}
        value={value}
        onChange={handleChange}
        placeholder={isRejected ? 'Comment (required)' : 'Comment (optional)'}
      />
      {showError ? <span className="text-danger small">Comment is required to reject.</span> : null}
    </div>
  );
};

/** Builds the Approve table columns: shared business columns + approval controls. */
export function getApprovePaColumns(params: IApprovePaColumnsParams): TableColumn<IApprovalInboxRow>[] {
  const { onView, decisions, submitAttempted, onDecision, onComment } = params;

  const decisionColumns: TableColumn<IApprovalInboxRow>[] = [
    {
      name: 'Approve',
      cell: (row) => (
        <input
          type="radio"
          className="form-check-input"
          name={`decision-${row.Id}`}
          aria-label={`Approve ${row.TPMNo} transaction ${row.Transaction}`}
          checked={decisions[row.Id]?.decision === APPROVAL_ACTION.APPROVE}
          onChange={() => onDecision(row.Id, 'Approve')}
        />
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: '90px',
    },
    {
      name: 'Reject',
      cell: (row) => (
        <input
          type="radio"
          className="form-check-input"
          name={`decision-${row.Id}`}
          aria-label={`Reject ${row.TPMNo} transaction ${row.Transaction}`}
          checked={decisions[row.Id]?.decision === APPROVAL_ACTION.REJECT}
          onChange={() => onDecision(row.Id, 'Reject')}
        />
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: '90px',
    },
    {
      name: 'Comment',
      cell: (row) => (
        <CommentInput
          rowId={row.Id}
          initialValue={decisions[row.Id]?.comment ?? ''}
          isRejected={decisions[row.Id]?.decision === APPROVAL_ACTION.REJECT}
          submitAttempted={submitAttempted}
          onComment={onComment}
        />
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      width: '260px',
    },
  ];

  // Insert the approval controls immediately AFTER the Status column (found by name so it
  // survives changes to the shared column list), rather than appending them at the far right.
  // The columns array drives both header and cells, so headers stay aligned automatically.
  const businessColumns = getAllPaColumns<IApprovalInboxRow>(onView);
  const statusIndex = businessColumns.findIndex((column) => column.name === 'Status');
  const insertAt = statusIndex >= 0 ? statusIndex + 1 : businessColumns.length;

  return [
    ...businessColumns.slice(0, insertAt),
    ...decisionColumns,
    ...businessColumns.slice(insertAt),
  ];
}
