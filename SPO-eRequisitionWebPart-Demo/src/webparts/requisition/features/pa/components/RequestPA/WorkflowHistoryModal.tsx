// Read-only Workflow History viewer for a transaction (opened from "View Workflow History").
// Presentational: receives state + onDismiss; data loading lives in useTransactionArtifacts.
// No header/close button — the Modal is non-blocking, so clicking outside it dismisses it.

import * as React from 'react';
import { Modal, Spinner } from '@fluentui/react';

import { IModalState } from '@/features/pa/hooks/useTransactionArtifacts';
import { IWorkflowHistoryEntry } from '@/features/pa/types';
import styles from './RequestPA.module.scss';

interface IWorkflowHistoryModalProps {
  state: IModalState<IWorkflowHistoryEntry>;
  onDismiss: () => void;
}

/** Zero-pads to 2 digits (avoids String.prototype.padStart — not in this project's lib target). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Formats an ISO date as DD/MM/YYYY HH:MM:SS (24-hour), independent of browser locale. */
function formatDate(iso: string): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes}:${seconds}`;
}

const WorkflowHistoryModal: React.FC<IWorkflowHistoryModalProps> = ({ state, onDismiss }) => (
  <Modal
    isOpen={state.isOpen}
    onDismiss={onDismiss}
    isBlocking={false}
    styles={{ main: { borderRadius: 8, overflow: 'hidden' } }}
  >
    <div className={styles.workflowHistoryModal}>
      {state.isLoading ? (
        <Spinner label="Loading..." />
      ) : state.error ? (
        <div className="alert alert-danger mb-0">{state.error}</div>
      ) : state.items.length === 0 ? (
        <div className="text-muted">ไม่มีประวัติ workflow สำหรับรายการนี้</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped mb-0">
            <thead>
              <tr>
                <th>Ref No.</th>
                <th>Name</th>
                <th>Action</th>
                <th>Date</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((entry, index) => (
                <tr key={index}>
                  <td className="text-nowrap">{state.refNo}</td>
                  <td>{entry.user || '-'}</td>
                  <td>{entry.action || '-'}</td>
                  <td className="text-nowrap">{formatDate(entry.date)}</td>
                  <td>{entry.comment || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </Modal>
);

export default WorkflowHistoryModal;
