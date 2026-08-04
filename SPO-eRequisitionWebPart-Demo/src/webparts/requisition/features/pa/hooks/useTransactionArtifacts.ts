// Owns the "View Workflow History" and "Attachment" viewer state for the Request page.
// Kept out of useRequisitionForm so that large hook stays focused on the form itself.
// Components render the modals and delegate loading here (see docs/CONVENTIONS.md §6).

import * as React from 'react';

import { RequisitionService } from '@/features/pa/services/RequisitionService';
import { IAttachmentFile, IWorkflowHistoryEntry } from '@/features/pa/types';
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '@/shared/utils/notify';

/** Number of file slots the upload modal offers per transaction. */
export const ATTACHMENT_UPLOAD_SLOT_COUNT = 10;

function getService(): RequisitionService {
  return new RequisitionService();
}

export interface IModalState<T> {
  isOpen: boolean;
  refNo: string;
  isLoading: boolean;
  error: string | null;
  items: T[];
}

/** State for the "Attachment" upload modal (create/edit mode only — view mode uses IModalState). */
export interface IUploadState {
  isOpen: boolean;
  refNo: string;
  isUploading: boolean;
  /** One slot per row in the modal; `null` = not yet chosen for that slot. */
  files: Array<File | null>;
}

export interface IUseTransactionArtifacts {
  history: IModalState<IWorkflowHistoryEntry>;
  attachments: IModalState<IAttachmentFile>;
  upload: IUploadState;
  openHistory: (refNo: string) => void;
  closeHistory: () => void;
  openAttachments: (refNo: string) => void;
  closeAttachments: () => void;
  openUpload: (refNo: string) => void;
  closeUpload: () => void;
  setUploadFile: (slotIndex: number, file: File | null) => void;
  submitUpload: () => Promise<void>;
}

const emptyState = <T>(): IModalState<T> => ({
  isOpen: false,
  refNo: '',
  isLoading: false,
  error: null,
  items: [],
});

const emptyUploadState = (): IUploadState => ({
  isOpen: false,
  refNo: '',
  isUploading: false,
  files: new Array(ATTACHMENT_UPLOAD_SLOT_COUNT).fill(null),
});

export function useTransactionArtifacts(): IUseTransactionArtifacts {
  const [history, setHistory] = React.useState<IModalState<IWorkflowHistoryEntry>>(
    emptyState<IWorkflowHistoryEntry>(),
  );
  const [attachments, setAttachments] = React.useState<IModalState<IAttachmentFile>>(
    emptyState<IAttachmentFile>(),
  );
  const [upload, setUpload] = React.useState<IUploadState>(emptyUploadState());

  const openHistory = React.useCallback((refNo: string): void => {
    setHistory({ isOpen: true, refNo, isLoading: true, error: null, items: [] });
    getService()
      .getWorkflowHistory(refNo)
      .then((items) => setHistory((prev) => (prev.refNo === refNo ? { ...prev, isLoading: false, items } : prev)))
      .catch((error) => {
        console.error('[useTransactionArtifacts] failed to load workflow history.', error);
        setHistory((prev) =>
          prev.refNo === refNo ? { ...prev, isLoading: false, error: 'ไม่สามารถโหลดประวัติ workflow ได้' } : prev,
        );
      });
  }, []);

  const openAttachments = React.useCallback((refNo: string): void => {
    setAttachments({ isOpen: true, refNo, isLoading: true, error: null, items: [] });
    getService()
      .getTransactionAttachments(refNo)
      .then((items) =>
        setAttachments((prev) => (prev.refNo === refNo ? { ...prev, isLoading: false, items } : prev)),
      )
      .catch((error) => {
        console.error('[useTransactionArtifacts] failed to load attachments.', error);
        setAttachments((prev) =>
          prev.refNo === refNo ? { ...prev, isLoading: false, error: 'ไม่สามารถโหลดไฟล์แนบได้' } : prev,
        );
      });
  }, []);

  const closeHistory = React.useCallback((): void => setHistory(emptyState<IWorkflowHistoryEntry>()), []);
  const closeAttachments = React.useCallback(
    (): void => setAttachments(emptyState<IAttachmentFile>()),
    [],
  );

  const openUpload = React.useCallback((refNo: string): void => {
    setUpload({ ...emptyUploadState(), isOpen: true, refNo });
  }, []);

  const closeUpload = React.useCallback((): void => setUpload(emptyUploadState()), []);

  const setUploadFile = React.useCallback((slotIndex: number, file: File | null): void => {
    setUpload((prev) => {
      const files = [...prev.files];
      files[slotIndex] = file;
      return { ...prev, files };
    });
  }, []);

  const submitUpload = React.useCallback(async (): Promise<void> => {
    const files = upload.files.filter((file): file is File => file !== null);
    if (files.length === 0) {
      showWarningAlert('กรุณาเลือกไฟล์อย่างน้อยหนึ่งไฟล์ก่อนอัปโหลด');
      return;
    }

    setUpload((prev) => ({ ...prev, isUploading: true }));
    try {
      const result = await getService().uploadAttachments(upload.refNo, files);
      if (result.failed.length > 0) {
        const list = result.failed.map((f) => `<li>${f.name}: ${f.message}</li>`).join('');
        showWarningAlert(
          `อัปโหลดสำเร็จ ${result.succeeded.length} ไฟล์ ` +
            `แต่มี ${result.failed.length} ไฟล์ที่ไม่สำเร็จ:<ul style="text-align:left;">${list}</ul>`,
        );
      } else {
        showSuccessAlert(`อัปโหลดไฟล์สำเร็จทั้งหมด ${result.succeeded.length} ไฟล์`);
      }
      setUpload(emptyUploadState());
    } catch (error) {
      console.error('[useTransactionArtifacts] upload failed.', error);
      showErrorAlert('ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง');
      setUpload((prev) => ({ ...prev, isUploading: false }));
    }
  }, [upload]);

  return {
    history,
    attachments,
    upload,
    openHistory,
    closeHistory,
    openAttachments,
    closeAttachments,
    openUpload,
    closeUpload,
    setUploadFile,
    submitUpload,
  };
}
