// Attachment upload modal for the Request page (create/edit mode). Offers a fixed number of
// file-picker slots; nothing uploads until "Upload" is pressed. Presentational: receives state +
// handlers, all loading/upload logic lives in useTransactionArtifacts.

import * as React from 'react';
import { Modal, IconButton } from '@fluentui/react';

import { IUploadState } from '@/features/pa/hooks/useTransactionArtifacts';
import styles from './RequestPA.module.scss';

interface IAttachmentUploadModalProps {
  state: IUploadState;
  onDismiss: () => void;
  onFileChange: (slotIndex: number, file: File | null) => void;
  onUpload: () => void;
}

const AttachmentUploadModal: React.FC<IAttachmentUploadModalProps> = ({
  state,
  onDismiss,
  onFileChange,
  onUpload,
}) => (
  <Modal isOpen={state.isOpen} onDismiss={onDismiss} isBlocking={false}>
    <div className={styles.uploadModal}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="fa fa-paperclip me-2" />
          Attachment — {state.refNo}
        </h5>
        <IconButton iconProps={{ iconName: 'Cancel' }} ariaLabel="Close" onClick={onDismiss} />
      </div>

      {state.files.map((file, slotIndex) => (
        <div key={slotIndex} className={`d-flex align-items-center ${styles.uploadSlot}`}>
          <span className={styles.uploadSlotLabel}>Choose a file {slotIndex + 1}.</span>
          <label className="btn btn-outline-secondary rounded-xl btn-sm mb-0">
            Select file
            <input
              type="file"
              className="d-none"
              onChange={(e) => onFileChange(slotIndex, e.target.files?.[0] ?? null)}
            />
          </label>
          {file ? <span className="ms-2 text-truncate">{file.name}</span> : null}
        </div>
      ))}

      <div className="d-flex justify-content-end mt-3">
        <button
          type="button"
          className="btn btn-success rounded-xl"
          onClick={onUpload}
          disabled={state.isUploading}
        >
          {state.isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  </Modal>
);

export default AttachmentUploadModal;
