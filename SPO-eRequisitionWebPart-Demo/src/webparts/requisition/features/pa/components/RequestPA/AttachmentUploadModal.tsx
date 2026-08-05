// Attachment upload modal for the Request page (create/edit mode). Offers a fixed number of
// file-picker slots; nothing uploads here — files are staged on the transaction
// (IRequisitionTransaction.pendingAttachments) and uploaded when the form is saved
// (Save Draft / Send To Approve). Presentational: state lives in useRequisitionForm.

import * as React from 'react';
import { Modal, IconButton } from '@fluentui/react';

import styles from './RequestPA.module.scss';

/** Number of file slots the modal offers per transaction. */
const SLOT_COUNT = 10;

interface IAttachmentUploadModalProps {
  isOpen: boolean;
  /** Ref No shown in the modal header (may not be the transaction's final Ref No — see
   * useTransactionArtifacts.IUploadModalState). */
  refNo: string;
  /** Files staged so far for this transaction; shorter than SLOT_COUNT renders as empty slots. */
  files: Array<File | null>;
  onDismiss: () => void;
  onFileChange: (slotIndex: number, file: File | null) => void;
}

const AttachmentUploadModal: React.FC<IAttachmentUploadModalProps> = ({
  isOpen,
  refNo,
  files,
  onDismiss,
  onFileChange,
}) => (
  <Modal
    isOpen={isOpen}
    onDismiss={onDismiss}
    isBlocking={false}
    styles={{ main: { borderRadius: 16, overflow: 'hidden' } }}
  >
    <div className={styles.uploadModal}>
      <div className={styles.uploadModalHeader}>
        <h5 className="mb-0">
          <i className="fa fa-paperclip me-2" />
          Attachment — {refNo}
        </h5>
        <IconButton iconProps={{ iconName: 'Cancel' }} ariaLabel="Close" onClick={onDismiss} />
      </div>

      <div className={styles.uploadModalBody}>
        {Array.from({ length: SLOT_COUNT }, (_, slotIndex) => slotIndex).map((slotIndex) => {
          const file = files[slotIndex] ?? null;
          return (
            <div key={slotIndex} className={`d-flex align-items-center ${styles.uploadSlot}`}>
              <span className={styles.uploadSlotLabel}>Choose a file {slotIndex + 1}.</span>
              <label className={`btn btn-outline-secondary rounded-xl btn-sm mb-0 ${styles.selectFileButton}`}>
                Select file
                <input
                  type="file"
                  className="d-none"
                  onChange={(e) => onFileChange(slotIndex, e.target.files?.[0] ?? null)}
                />
              </label>
              {file ? (
                <span className={`ms-2 d-flex align-items-center ${styles.uploadFileWrapper}`}>
                  <span className={`text-truncate ${styles.uploadFileName}`} title={file.name}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-danger p-0 ms-1 flex-shrink-0"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onFileChange(slotIndex, null)}
                  >
                    <i className="fa fa-times" />
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  </Modal>
);

export default AttachmentUploadModal;
