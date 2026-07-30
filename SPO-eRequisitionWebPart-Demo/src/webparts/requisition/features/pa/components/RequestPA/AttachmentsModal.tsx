// Read-only Attachments viewer for a transaction (opened from the "Attachment" button).
// Presentational: receives state + onDismiss; data loading lives in useTransactionArtifacts.

import * as React from 'react';
import { Modal, IconButton, Spinner } from '@fluentui/react';

import { IModalState } from '@/features/pa/hooks/useTransactionArtifacts';
import { IAttachmentFile } from '@/features/pa/types';
import styles from './RequestPA.module.scss';

interface IAttachmentsModalProps {
  state: IModalState<IAttachmentFile>;
  onDismiss: () => void;
}

const AttachmentsModal: React.FC<IAttachmentsModalProps> = ({ state, onDismiss }) => (
  <Modal isOpen={state.isOpen} onDismiss={onDismiss} isBlocking={false}>
    <div className={styles.viewerModal}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="fa fa-paperclip me-2" />
          Attachments — {state.refNo}
        </h5>
        <IconButton iconProps={{ iconName: 'Cancel' }} ariaLabel="Close" onClick={onDismiss} />
      </div>

      {state.isLoading ? (
        <Spinner label="Loading..." />
      ) : state.error ? (
        <div className="alert alert-danger mb-0">{state.error}</div>
      ) : state.items.length === 0 ? (
        <div className="text-muted">ไม่มีไฟล์แนบสำหรับรายการนี้</div>
      ) : (
        <ul className="list-group">
          {state.items.map((file, index) => (
            <li key={index} className="list-group-item d-flex align-items-center">
              <i className="fa fa-file-o me-2" />
              <a href={file.url} target="_blank" rel="noopener noreferrer">
                {file.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  </Modal>
);

export default AttachmentsModal;
