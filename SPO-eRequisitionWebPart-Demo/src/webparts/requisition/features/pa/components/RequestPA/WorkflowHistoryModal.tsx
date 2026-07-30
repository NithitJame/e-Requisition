// Read-only Workflow History viewer for a transaction (opened from "View Workflow History").
// Presentational: receives state + onDismiss; data loading lives in useTransactionArtifacts.

import * as React from 'react';
import { Modal, IconButton, Spinner } from '@fluentui/react';

import { IModalState } from '@/features/pa/hooks/useTransactionArtifacts';
import { IWorkflowHistoryEntry } from '@/features/pa/types';
import styles from './RequestPA.module.scss';

interface IWorkflowHistoryModalProps {
  state: IModalState<IWorkflowHistoryEntry>;
  onDismiss: () => void;
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date.toLocaleString();
}

const WorkflowHistoryModal: React.FC<IWorkflowHistoryModalProps> = ({ state, onDismiss }) => (
  <Modal isOpen={state.isOpen} onDismiss={onDismiss} isBlocking={false}>
    <div className={styles.viewerModal}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="fa fa-history me-2" />
          Workflow History — {state.refNo}
        </h5>
        <IconButton iconProps={{ iconName: 'Cancel' }} ariaLabel="Close" onClick={onDismiss} />
      </div>

      {state.isLoading ? (
        <Spinner label="Loading..." />
      ) : state.error ? (
        <div className="alert alert-danger mb-0">{state.error}</div>
      ) : state.items.length === 0 ? (
        <div className="text-muted">ไม่มีประวัติ workflow สำหรับรายการนี้</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-bordered mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Action</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((entry, index) => (
                <tr key={index}>
                  <td className="text-nowrap">{formatDate(entry.date)}</td>
                  <td>{entry.user || '-'}</td>
                  <td>{entry.action || '-'}</td>
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
