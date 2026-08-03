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

export interface IUseTransactionArtifacts {
  history: IModalState<IWorkflowHistoryEntry>;
  attachments: IModalState<IAttachmentFile>;
  openHistory: (refNo: string) => void;
  closeHistory: () => void;
  openAttachments: (refNo: string) => void;
  closeAttachments: () => void;
}

const emptyState = <T>(): IModalState<T> => ({
  isOpen: false,
  refNo: '',
  isLoading: false,
  error: null,
  items: [],
});

export function useTransactionArtifacts(): IUseTransactionArtifacts {
  const [history, setHistory] = React.useState<IModalState<IWorkflowHistoryEntry>>(
    emptyState<IWorkflowHistoryEntry>(),
  );
  const [attachments, setAttachments] = React.useState<IModalState<IAttachmentFile>>(
    emptyState<IAttachmentFile>(),
  );

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

  return { history, attachments, openHistory, closeHistory, openAttachments, closeAttachments };
}
