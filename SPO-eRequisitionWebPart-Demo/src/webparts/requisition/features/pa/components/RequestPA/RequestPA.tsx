// PA request form. Thin shell: delegates all state/logic to useRequisitionForm
// and composes the header, per-transaction sections, and footer actions.
// In view mode (opened from the list via ?_id=), everything is read-only, the selected
// transaction is highlighted, and Workflow History / Attachments viewers are available.

import * as React from 'react';
import { DefaultButton } from '@fluentui/react';

import LoadingOverlay from '@/shared/components/LoadingOverlay';
import { useRequisitionForm } from '@/features/pa/hooks/useRequisitionForm';
import { useTransactionArtifacts } from '@/features/pa/hooks/useTransactionArtifacts';
import RequisitionHeader from './RequisitionHeader';
import TransactionSection from './TransactionSection';
import MockDataSeeder from './MockDataSeeder';
import WorkflowHistoryModal from './WorkflowHistoryModal';
import AttachmentsModal from './AttachmentsModal';
import AttachmentUploadModal from './AttachmentUploadModal';
import styles from './RequestPA.module.scss';

// Dev-only tooling (Mock Data Seeder) is excluded from production bundles.
const isDevMode = process.env.NODE_ENV !== 'production';

const RequestPA: React.FC = () => {
  const form = useRequisitionForm();
  const artifacts = useTransactionArtifacts();
  const [isMockSeederOpen, setIsMockSeederOpen] = React.useState(false);

  // Dev seeder must never be usable in view mode (it would overwrite the loaded record).
  const showDevTools = isDevMode && !form.disabledAction;

  const backButton = form.disabledAction ? (
    <div className="row mb-2">
      <div className="col-12">
        <button className="btn btn-outline-secondary rounded-xl" onClick={form.goBack}>
          <i className="fa fa-arrow-left me-1" /> Back
        </button>
      </div>
    </div>
  ) : null;

  if (form.loadError) {
    return (
      <>
        <LoadingOverlay isLoading={form.isLoading} />
        {backButton}
        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-danger">{form.loadError}</div>
          </div>
        </div>
      </>
    );
  }

  if (form.notFound) {
    return (
      <>
        {backButton}
        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-warning">Promotion Activity not found</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <LoadingOverlay isLoading={form.isLoading} />

      {backButton}

      {showDevTools ? (
        <div className={styles.devToolbar}>
          <DefaultButton text="Seed Mock Data" onClick={() => setIsMockSeederOpen(true)} />
        </div>
      ) : null}

      <RequisitionHeader
        channel={form.channel}
        fiscalYear={form.fiscalYear}
        fiscalYearOptions={form.fiscalYearOptions}
        promotionMonth={form.promotionMonth}
        eRequisitionNo={form.eRequisitionNo}
        totalSpendingTI={form.totalSpendingTI}
        totalSpendingTD={form.totalSpendingTD}
        disabled={form.disabledAction}
        onChannelChange={form.setChannel}
        onFiscalYearChange={form.setFiscalYear}
        onPromotionMonthChange={form.setPromotionMonth}
      />

      <div className="row">
        <div className="col-12">
          <hr className="hr-dashed" />
        </div>
      </div>

      <div className="row">
        {form.transactions.map((transaction, index) => (
          <TransactionSection
            key={index}
            index={index}
            transaction={transaction}
            disabled={form.disabledAction}
            handlers={form.handlers}
            tpmNo={form.eRequisitionNo}
            isHighlighted={
              form.selectedTransaction !== null &&
              Number(transaction.tebles[0]?.Transaction) === form.selectedTransaction
            }
            onOpenHistory={artifacts.openHistory}
            onOpenAttachment={artifacts.openAttachments}
            onOpenUpload={artifacts.openUpload}
          />
        ))}
      </div>

      <div className="row mt-3">
        <div className="col-12">
          <hr className="hr-bold" />
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-12">
          {!form.disabledAction ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-info rounded-xl"
              onClick={form.handlers.addTransaction}
            >
              <i className="fa fa-plus me-1" /> Add Promotion
            </button>
          ) : null}
        </div>
      </div>

      <div className="row mt-5">
        <div className="col-12">
          {!form.disabledAction ? (
            <>
              <button
                className={`btn btn-secondary btn-custom-1 rounded-xl me-2 ${styles.actionButton}`}
                onClick={() => form.save('Draft')}
              >
                Save Draft
              </button>
              <button
                className={`btn btn-danger rounded-xl me-2 ${styles.actionButton}`}
                onClick={() => form.save('Submit')}
              >
                Send To Approve
              </button>
            </>
          ) : null}
        </div>
      </div>

      {showDevTools ? (
        <MockDataSeeder
          isOpen={isMockSeederOpen}
          onDismiss={() => setIsMockSeederOpen(false)}
          onPopulate={form.loadMockData}
        />
      ) : null}

      <WorkflowHistoryModal state={artifacts.history} onDismiss={artifacts.closeHistory} />
      <AttachmentsModal state={artifacts.attachments} onDismiss={artifacts.closeAttachments} />
      <AttachmentUploadModal
        state={artifacts.upload}
        onDismiss={artifacts.closeUpload}
        onFileChange={artifacts.setUploadFile}
        onUpload={artifacts.submitUpload}
      />
    </>
  );
};

export default RequestPA;
