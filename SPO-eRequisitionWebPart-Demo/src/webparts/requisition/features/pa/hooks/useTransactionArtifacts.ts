// Owns the "View Workflow History" and "Attachment" viewer state for the Request page.
// Kept out of useRequisitionForm so that large hook stays focused on the form itself.
// Components render the modals and delegate loading here (see docs/CONVENTIONS.md §6).

import * as React from 'react';

import { RequisitionService } from '@/features/pa/services/RequisitionService';
import { IAttachmentFile, IWorkflowHistoryEntry } from '@/features/pa/types';

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

/**
 * Which transaction the Attachment upload modal is open for (create/edit mode only — view mode
 * uses IModalState). The staged files themselves live on the transaction
 * (IRequisitionTransaction.pendingAttachments, in useRequisitionForm) and are uploaded by
 * RequisitionService.saveRequisition, not here — this is only the "is it open, and for which
 * transaction" bit the modal needs.
 */
export interface IUploadModalState {
  isOpen: boolean;
  /** Index into the form's transactions array — identifies the row regardless of Ref No. */
  transactionIndex: number;
  /** Ref No shown in the modal header. May not match what the transaction is ultimately saved
   * under (e.g. a new transaction whose displayed number still shifts as others are added/removed). */
  refNo: string;
}

export interface IUseTransactionArtifacts {
  history: IModalState<IWorkflowHistoryEntry>;
  attachments: IModalState<IAttachmentFile>;
  uploadModal: IUploadModalState;
  openHistory: (refNo: string) => void;
  closeHistory: () => void;
  openAttachments: (refNo: string) => void;
  closeAttachments: () => void;
  openUploadModal: (transactionIndex: number, refNo: string) => void;
  closeUploadModal: () => void;
}

const emptyState = <T>(): IModalState<T> => ({
  isOpen: false,
  refNo: '',
  isLoading: false,
  error: null,
  items: [],
});

const emptyUploadModalState = (): IUploadModalState => ({
  isOpen: false,
  transactionIndex: -1,
  refNo: '',
});

export function useTransactionArtifacts(): IUseTransactionArtifacts {
  const [history, setHistory] = React.useState<IModalState<IWorkflowHistoryEntry>>(
    emptyState<IWorkflowHistoryEntry>(),
  );
  const [attachments, setAttachments] = React.useState<IModalState<IAttachmentFile>>(
    emptyState<IAttachmentFile>(),
  );
  const [uploadModal, setUploadModal] = React.useState<IUploadModalState>(emptyUploadModalState());

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

  const openUploadModal = React.useCallback((transactionIndex: number, refNo: string): void => {
    setUploadModal({ isOpen: true, transactionIndex, refNo });
  }, []);

  const closeUploadModal = React.useCallback((): void => setUploadModal(emptyUploadModalState()), []);

  return {
    history,
    attachments,
    uploadModal,
    openHistory,
    closeHistory,
    openAttachments,
    closeAttachments,
    openUploadModal,
    closeUploadModal,
  };
}
